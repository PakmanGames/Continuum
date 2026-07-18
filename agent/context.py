"""
Builds the diagnosis prompt: logs first, then — if the target container carries
a GIT_REPO_URL — a *capped* slice of its source and recent history.

The cap matters more than the model's price: an uncapped repo dump is where the
bill and the latency go. Files named in the logs (traceback paths) come first,
then the smallest files, until LLM_CONTEXT_KB is spent.
"""
import os
import re
import subprocess
import tempfile
from pathlib import Path

CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".rb", ".java", ".cs", ".php",
    ".yaml", ".yml", ".json", ".toml", ".sh", ".dockerfile", ".md",
}
SKIP_PARTS = {"node_modules", "__pycache__", ".venv", "venv", ".git", "dist", "build"}


def _log(msg: str) -> None:
    print(f"[context] {msg}", flush=True)


def clone(repo_url: str, target: str, timeout: int = 30) -> bool:
    try:
        subprocess.run(
            ["git", "clone", "--depth", "20", repo_url, target],
            check=True, capture_output=True, text=True, timeout=timeout,
        )
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
        _log(f"clone failed ({repo_url}): {getattr(e, 'stderr', e)}")
        return False


def recent_commits(repo_dir: str, limit: int = 10) -> str:
    try:
        out = subprocess.run(
            ["git", "log", f"-{limit}", "--pretty=format:%h %ad %s", "--date=short"],
            cwd=repo_dir, check=True, capture_output=True, text=True, timeout=10,
        ).stdout.strip()
        return out or "(no commits)"
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return "(unavailable)"


def source_slice(repo_dir: str, logs: str, cap_bytes: int) -> str:
    root = Path(repo_dir)
    files = [
        f for f in root.rglob("*")
        if f.is_file()
        and f.suffix.lower() in CODE_EXTENSIONS
        and not f.name.startswith(".")
        and not (set(f.parts) & SKIP_PARTS)
    ]
    mentioned = {m.group(1) for m in re.finditer(r"([\w\-.]+\.(?:py|js|ts|tsx|go|rs|rb|java))", logs)}
    files.sort(key=lambda f: (0 if f.name in mentioned else 1, f.stat().st_size))

    chunks, used = [], 0
    for f in files:
        text = f.read_text(encoding="utf-8", errors="ignore")
        size = len(text.encode("utf-8"))
        if used + size > cap_bytes:
            if used == 0:  # even the first file is too big: take its head
                text = text.encode("utf-8")[:cap_bytes].decode("utf-8", errors="ignore")
                chunks.append(f"\n=== {f.relative_to(root)} (truncated) ===\n{text}")
            break
        used += size
        chunks.append(f"\n=== {f.relative_to(root)} ===\n{text}")
    _log(f"{len(chunks)} file(s), {used // 1024} KB of source in context")
    return "".join(chunks)


def build_prompt(name: str, status: str, exit_code, logs: str, repo_url: str | None) -> str:
    prompt = (
        f"Container `{name}` failed. Docker state: {status}, exit code {exit_code}.\n\n"
        f"Last log lines:\n```\n{logs[-6000:]}\n```\n"
    )
    if not repo_url:
        return prompt

    cap = int(os.environ.get("LLM_CONTEXT_KB", "64")) * 1024
    with tempfile.TemporaryDirectory() as tmp:
        if not clone(repo_url, tmp):
            return prompt + "\n(Repository could not be cloned; logs only.)\n"
        prompt += (
            f"\nRepository: {repo_url}\nRecent commits:\n{recent_commits(tmp)}\n"
            f"\nSource (capped at {cap // 1024} KB, files named in the logs first):\n"
            f"{source_slice(tmp, logs, cap)}\n"
            "\nRelate the failure to the code and recent changes where you can."
        )
    return prompt
