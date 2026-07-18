"""
Continuum agent.

Watches the containers named in TARGET_CONTAINERS and closes the loop the
product is about:

    register → heartbeat (real Docker status) → poll commands → detect →
    diagnose (LLM, optional) → heal (docker restart) → verify → resolve

The control plane cannot reach us (we sit behind NAT, on a laptop or a host),
so everything is outbound: we register on boot, heartbeat, and *poll* for
commands the UI has queued. A `kill` from the UI is deliberately treated like
any other crash — that is the demo. A `stop`/`start`/`restart` from the UI is
an operator's intent and is not reported as an incident.
"""
import datetime as dt
import os
import socket
import sys
import time
from dataclasses import dataclass, field

import requests
from dotenv import load_dotenv

from context import build_prompt
from docker_tools import (
    get_container_env,
    get_container_logs,
    get_container_state,
    run_container_action,
)
from llm import Diagnosis, configured as llm_configured, diagnose

load_dotenv()

BACKEND = os.environ.get("AGENT_BACKEND_URL", "http://host.docker.internal:3000").rstrip("/")
TOKEN = os.environ.get("AGENT_TOKEN", "")
AGENT_NAME = os.environ.get("AGENT_NAME") or f"agent-{socket.gethostname()}"
TARGETS = [n.strip() for n in os.environ.get("TARGET_CONTAINERS", "demo-backend,demo-frontend").split(",") if n.strip()]
POLL_S = float(os.environ.get("POLL_S", "2"))
HEARTBEAT_S = float(os.environ.get("HEARTBEAT_S", "15"))
HEAL_VERIFY_S = float(os.environ.get("HEAL_VERIFY_S", "15"))
REMEDIATION = os.environ.get("REMEDIATION", "restart")  # restart | none
LOG_LINES = int(os.environ.get("LOG_LINES", "300"))

BAD_STATES = {"exited", "dead", "restarting"}
# After an operator-initiated stop/start/restart, ignore state churn this long.
COMMAND_GRACE_S = 10.0
# The DB columns are varchar(4096).
FIELD_CAP = 4000


def log(msg: str) -> None:
    print(f"{dt.datetime.now().strftime('%H:%M:%S')} {msg}", flush=True)


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- control plane

HEADERS = {"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"}


def api(method: str, path: str, **kwargs):
    """One place for the token, the timeout and the error log. Returns parsed
    JSON or None; callers treat None as "the control plane is unreachable"."""
    try:
        response = requests.request(method, f"{BACKEND}{path}", headers=HEADERS, timeout=15, **kwargs)
        if response.status_code >= 400:
            log(f"api {method} {path} → {response.status_code} {response.text[:200]}")
            return None
        return response.json()
    except requests.RequestException as e:
        log(f"api {method} {path} failed: {e}")
        return None


@dataclass
class Target:
    name: str
    id: int
    alive: bool = True
    last_status: str = ""
    last_heartbeat: float = 0.0
    grace_until: float = 0.0        # ignore failures until this time (operator command)
    stopped_on_purpose: bool = False
    open_incident: int | None = None
    diagnosis: Diagnosis | None = field(default=None, repr=False)


class Agent:
    def __init__(self) -> None:
        self.id: int | None = None
        self.targets: dict[str, Target] = {}

    # ---- lifecycle -------------------------------------------------------

    def register(self) -> None:
        """Retry until the control plane answers — it may still be starting."""
        while True:
            res = api("POST", "/api/agent/register", json={"agent": AGENT_NAME, "containers": TARGETS})
            if res:
                self.id = res["agentId"]
                self.targets = {name: Target(name=name, id=cid) for name, cid in res["containers"].items()}
                log(f"registered as {AGENT_NAME} (#{self.id}); watching {', '.join(self.targets)}")
                return
            log("registration failed; retrying in 5s")
            time.sleep(5)

    def run(self) -> None:
        log(f"Continuum agent starting → {BACKEND}")
        log(f"LLM: {'configured (' + os.environ['LLM_MODEL'] + ')' if llm_configured() else 'not configured — diagnoses will say so'}; remediation={REMEDIATION}")
        if not TOKEN:
            log("AGENT_TOKEN is empty — the control plane will refuse every call")
        self.register()
        while True:
            self.handle_commands()
            for target in self.targets.values():
                self.observe(target)
            time.sleep(POLL_S)

    # ---- heartbeats -------------------------------------------------------

    def heartbeat(self, t: Target, status: str, force: bool = False) -> None:
        """Report on change, or every HEARTBEAT_S as a keepalive — enough for
        the topology to be right without writing a status row per poll."""
        now = time.monotonic()
        if not force and status == t.last_status and now - t.last_heartbeat < HEARTBEAT_S:
            return
        if api("POST", "/api/agent/heartbeat", json={"containerId": t.id, "status": status, "checkedInAt": now_iso()}) is not None:
            t.last_heartbeat = now
        t.last_status = status

    # ---- commands from the UI --------------------------------------------

    def handle_commands(self) -> None:
        res = api("GET", f"/api/agent/commands?agentId={self.id}")
        for cmd in (res or {}).get("commands", []):
            name, action = cmd["containerName"], cmd["action"]
            t = self.targets.get(name)
            log(f"command #{cmd['id']}: {action} {name}")
            if t and action in ("stop", "start", "restart"):
                # Operator intent — don't report the resulting state change as a crash.
                t.grace_until = time.monotonic() + COMMAND_GRACE_S
                t.stopped_on_purpose = action == "stop"
                if action in ("start", "restart"):
                    t.alive = True
            ok, out = run_container_action(name, action)
            log(f"  → {'ok' if ok else 'FAILED'}: {out[:160]}")
            api("POST", f"/api/agent/commands/{cmd['id']}/ack", json={"agentId": self.id, "status": "done" if ok else "failed", "result": out[:1000]})
            if t:
                state = get_container_state(name)
                if state:
                    self.heartbeat(t, state["status"], force=True)

    # ---- detection ----------------------------------------------------------

    def observe(self, t: Target) -> None:
        state = get_container_state(t.name)
        if state is None:
            self.heartbeat(t, "stopped")
            return
        status = state["status"]
        self.heartbeat(t, status)

        failed = status in BAD_STATES
        if failed:
            if t.alive and not t.stopped_on_purpose and time.monotonic() >= t.grace_until:
                t.alive = False
                self.on_fail(t, state)
        elif not t.alive:
            t.alive = True
            t.stopped_on_purpose = False
            log(f"[{t.name}] recovered ({status})")
            if t.open_incident:
                # It came back without us — someone else acted. Close honestly.
                api("POST", f"/api/agent/incidents/{t.open_incident}/resolve", json={"agentId": self.id, "action": "recovered", "note": "container came back without agent action"})
                t.open_incident = None

    # ---- the loop that matters ---------------------------------------------

    def on_fail(self, t: Target, state: dict) -> None:
        log(f"[{t.name}] FAILED — {state['status']}, exit {state['exit_code']}")
        logs = get_container_logs(t.name, LOG_LINES)

        try:
            repo = get_container_env(t.name, "GIT_REPO_URL")
            t.diagnosis = diagnose(build_prompt(t.name, state["status"], state["exit_code"], logs, repo))
            log(f"[{t.name}] diagnosed: {t.diagnosis.explanation[:120]}")
        except Exception as e:  # network, auth, provider outage — never block the heal
            t.diagnosis = Diagnosis(explanation=f"Diagnosis unavailable: {e}", suggestedFix="Read the captured logs; the agent restarted the container.")
            log(f"[{t.name}] diagnosis failed: {e}")

        res = api("POST", "/api/agent/data-ingest", json={
            "agentId": self.id,
            "containerId": t.id,
            "serviceName": t.name,
            "errorMessage": logs[-FIELD_CAP:] or "No logs available",
            "explanation": t.diagnosis.explanation[:FIELD_CAP],
            "suggestedFix": t.diagnosis.suggestedFix[:FIELD_CAP],
            "occurredAt": now_iso(),
        })
        t.open_incident = (res or {}).get("incidentId")
        log(f"[{t.name}] incident #{t.open_incident} recorded" if t.open_incident else f"[{t.name}] incident NOT recorded (control plane unreachable)")

        if REMEDIATION == "restart":
            self.heal(t)

    def heal(self, t: Target) -> None:
        ok, out = run_container_action(t.name, "restart")
        if not ok:
            log(f"[{t.name}] restart FAILED: {out[:160]} — leaving the incident open")
            return
        log(f"[{t.name}] restarted; verifying for {HEAL_VERIFY_S:.0f}s")

        deadline = time.monotonic() + HEAL_VERIFY_S
        while time.monotonic() < deadline:
            state = get_container_state(t.name)
            status = state["status"] if state else "stopped"
            self.heartbeat(t, status)
            if status in BAD_STATES:
                log(f"[{t.name}] failed again ({status}) — leaving the incident open for a human")
                return
            time.sleep(1)

        t.alive = True
        if t.open_incident:
            api("POST", f"/api/agent/incidents/{t.open_incident}/resolve", json={"agentId": self.id, "action": "restart", "note": f"healthy for {HEAL_VERIFY_S:.0f}s"})
            log(f"[{t.name}] healed — incident #{t.open_incident} resolved")
            t.open_incident = None


if __name__ == "__main__":
    try:
        Agent().run()
    except KeyboardInterrupt:
        sys.exit(0)
