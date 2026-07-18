"""Thin wrappers over the docker CLI (installed in the agent image; the host's
socket is mounted). Kept as CLI calls rather than an SDK so the agent stays a
single small process with no daemon-version coupling."""
import json
import os
import shutil
import subprocess

ACTIONS = ("kill", "stop", "start", "restart")


def docker_cmd() -> str | None:
    found = shutil.which("docker")
    if found:
        return found
    for path in ("/usr/bin/docker", "/usr/local/bin/docker", "/bin/docker"):
        if os.path.exists(path):
            return path
    return None


def get_container_state(name: str) -> dict | None:
    cmd = docker_cmd()
    if not cmd:
        return None
    try:
        result = subprocess.run([cmd, "inspect", name], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return None
        info = json.loads(result.stdout)[0]
        state = info["State"]
        return {
            "status": state["Status"],
            "restart_count": info.get("RestartCount", 0),
            "exit_code": state.get("ExitCode", 0),
            "finished_at": state.get("FinishedAt", ""),
            "started_at": state.get("StartedAt", ""),
        }
    except (subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, IndexError, OSError) as e:
        print(f"[docker] inspect {name} failed: {e}", flush=True)
        return None


def get_container_logs(name: str, lines: int = 300) -> str:
    cmd = docker_cmd()
    if not cmd:
        return "Error: docker binary not found"
    try:
        result = subprocess.run(
            [cmd, "logs", "--tail", str(lines), name], capture_output=True, text=True, timeout=10
        )
        logs = result.stdout + result.stderr
        return logs if logs else "No logs available"
    except (subprocess.TimeoutExpired, OSError) as e:
        return f"Error fetching logs: {e}"


def get_container_env(name: str, var_name: str) -> str | None:
    cmd = docker_cmd()
    if not cmd:
        return None
    try:
        result = subprocess.run(
            [cmd, "inspect", "-f", "{{range .Config.Env}}{{println .}}{{end}}", name],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return None
        for line in result.stdout.splitlines():
            key, sep, value = line.partition("=")
            if sep and key == var_name:
                return value
        return None
    except (subprocess.TimeoutExpired, OSError):
        return None


def run_container_action(name: str, action: str) -> tuple[bool, str]:
    """`docker <kill|stop|start|restart> <name>` → (ok, combined output)."""
    if action not in ACTIONS:
        return False, f"unsupported action {action!r}"
    cmd = docker_cmd()
    if not cmd:
        return False, "docker binary not found"
    try:
        result = subprocess.run([cmd, action, name], capture_output=True, text=True, timeout=60)
        out = (result.stdout + result.stderr).strip()
        return result.returncode == 0, out or f"{action} {name}: ok"
    except (subprocess.TimeoutExpired, OSError) as e:
        return False, f"{action} {name} failed: {e}"
