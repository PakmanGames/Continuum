"""
Provider-agnostic diagnosis.

Talks to any OpenAI-compatible chat-completions endpoint — OpenAI, Gemini,
Anthropic, Groq, OpenRouter, Together, Ollama all expose one — so a single
client covers whichever key the operator has. Configured entirely by env:

    LLM_API_KEY   required to enable diagnosis
    LLM_MODEL     required (never hard-coded here)
    LLM_BASE_URL  optional, default https://api.openai.com/v1

Without a key the agent still detects, heals and reports; the explanation just
says so. Callers only ever see a `Diagnosis`.
"""
import json
import os

import requests
from pydantic import BaseModel, Field, ValidationError


class Diagnosis(BaseModel):
    explanation: str = Field(..., description="What went wrong, in plain English")
    suggestedFix: str = Field(..., description="The change that would prevent it")


SYSTEM = (
    "You are a senior SRE. You will be given the last lines of a container's logs, its "
    "state, and possibly source code and recent commits. Reply with ONLY a JSON object of "
    'the form {"explanation": "...", "suggestedFix": "..."}. The explanation says what went '
    "wrong and why in a few sentences; the fix is the concrete change (file, setting, or "
    "command) that would stop it recurring. No markdown, no prose outside the JSON."
)

UNAVAILABLE = Diagnosis(
    explanation=(
        "Diagnosis unavailable: no LLM is configured on this agent. Set LLM_API_KEY and "
        "LLM_MODEL (and LLM_BASE_URL for a non-OpenAI provider) to enable it."
    ),
    suggestedFix="Read the captured logs above. The agent restarted the container.",
)


def configured() -> bool:
    return bool(os.environ.get("LLM_API_KEY")) and bool(os.environ.get("LLM_MODEL"))


def _parse(text: str) -> Diagnosis:
    """Accepts bare JSON, fenced JSON, or JSON embedded in prose."""
    body = text.strip()
    if body.startswith("```"):
        body = body.strip("`")
        body = body[body.find("{"):] if "{" in body else body
    start, end = body.find("{"), body.rfind("}")
    if start != -1 and end > start:
        try:
            return Diagnosis.model_validate(json.loads(body[start : end + 1]))
        except (json.JSONDecodeError, ValidationError):
            pass
    return Diagnosis(
        explanation=text.strip()[:3000] or "The model returned an empty reply.",
        suggestedFix="(The model did not return the expected JSON shape.)",
    )


def diagnose(prompt: str, timeout: float = 90) -> Diagnosis:
    """Raises on transport/HTTP errors so the caller can record *why* it failed."""
    if not configured():
        return UNAVAILABLE

    base = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    headers = {
        "Authorization": f"Bearer {os.environ['LLM_API_KEY']}",
        "Content-Type": "application/json",
    }
    body = {
        "model": os.environ["LLM_MODEL"],
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }

    # Ask for JSON mode first; providers that don't support `response_format`
    # reject it with a 400, so fall back to the prompt-instructed JSON.
    for attempt in (1, 2):
        if attempt == 1:
            body["response_format"] = {"type": "json_object"}
        else:
            body.pop("response_format", None)
        response = requests.post(f"{base}/chat/completions", json=body, headers=headers, timeout=timeout)
        if attempt == 1 and response.status_code == 400 and "response_format" in response.text:
            continue
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return _parse(content if isinstance(content, str) else json.dumps(content))
    return UNAVAILABLE  # unreachable, keeps type-checkers calm
