"""Optional Langfuse logging for eval runs.

Env-gated: without LANGFUSE_PUBLIC_KEY/SECRET_KEY (or without the SDK
installed) every function is a no-op and the harness behaves exactly as
before. Only eval material (public scripts, engineered variants, metrics)
is ever sent — never user scripts.
"""

import os


def get_client():
    if not (os.environ.get("LANGFUSE_PUBLIC_KEY") and os.environ.get("LANGFUSE_SECRET_KEY")):
        return None
    try:
        from langfuse import Langfuse
    except ImportError:
        print("langfuse keys set but SDK missing — `uv sync` to install; continuing without tracing")
        return None
    try:
        return Langfuse()  # reads LANGFUSE_* env, including LANGFUSE_HOST
    except Exception as exc:
        print(f"langfuse init failed ({exc}); continuing without tracing")
        return None


METRIC_KEYS = ("spine", "rating", "budget", "comps", "trap", "pair", "flip")


def log_run(client, pair_tag: str, record: dict) -> None:
    """One trace per eval run/check, metrics attached as scores."""
    if client is None:
        return
    try:
        trace = client.trace(
            name=f"screenscore-eval:{record['item']}",
            tags=[pair_tag, record.get("kind", "run"), f"seed:{record.get('seed', '-')}"],
            metadata={k: v for k, v in record.items() if k not in METRIC_KEYS},
        )
        for key in METRIC_KEYS:
            value = record.get(key)
            if isinstance(value, (int, float)) and value == value:
                trace.score(name=key, value=float(value))
        verify = record.get("verify") or {}
        if isinstance(verify.get("integrity"), float):
            trace.score(name="citation_integrity", value=verify["integrity"])
        if record.get("status") and record.get("kind") not in ("pair_check", "flip_rate"):
            trace.score(name="completed", value=1.0 if record["status"] == "complete" else 0.0)
    except Exception as exc:
        print(f"langfuse log_run failed ({exc}); continuing")


def log_summary(client, pair_tag: str, summary: dict) -> None:
    if client is None:
        return
    try:
        trace = client.trace(
            name=f"screenscore-eval:SUMMARY:{pair_tag}",
            tags=[pair_tag, "summary"],
            metadata=summary,
        )
        for key, value in summary.items():
            if isinstance(value, (int, float)) and value == value:
                trace.score(name=f"summary_{key}", value=float(value))
    except Exception as exc:
        print(f"langfuse log_summary failed ({exc}); continuing")


def flush(client) -> None:
    if client is not None:
        try:
            client.flush()
        except Exception:
            pass
