"""Robust JSON extraction from local-model output.

Small instruct models fence, preface, and trail their JSON. Policy: try to
extract; on failure the caller retries the generation once with a stricter
suffix; a second failure raises StageOutputError for the caller to handle
(specialists degrade to insufficient_evidence, synthesis fails the run).
"""

import json
import re

FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)

RETRY_SUFFIX = (
    "\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object, "
    "starting with { and ending with } — no prose, no markdown fences."
)


class StageOutputError(ValueError):
    pass


def extract_json(text: str) -> dict:
    """Best-effort dict extraction; raises StageOutputError if hopeless."""
    candidates = [text.strip()]
    candidates += [m.strip() for m in FENCE_RE.findall(text)]
    brace = _first_balanced_object(text)
    if brace:
        candidates.append(brace)
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue
    raise StageOutputError(f"no JSON object found in model output: {text[:200]!r}")


def _first_balanced_object(text: str) -> str | None:
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escaped = False
    for i, ch in enumerate(text[start:], start):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


async def generate_json(runtime, model: str, prompt: str, *, options: dict | None = None) -> dict:
    """One generation + one stricter retry, then StageOutputError."""
    text = await runtime.generate(model, prompt, json_format=True, options=options)
    try:
        return extract_json(text)
    except StageOutputError:
        text = await runtime.generate(model, prompt + RETRY_SUFFIX, json_format=True, options=options)
        return extract_json(text)
