"""Report schema loading and validation.

The engine validates every report against report.schema.json before it is
persisted — an invalid report is a bug, never something to store or render.
"""

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA_PATH = Path(__file__).parent / "report.schema.json"


@lru_cache(maxsize=1)
def report_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text())


class ReportValidationError(ValueError):
    pass


def validate_report(report: dict) -> None:
    """Raise ReportValidationError listing every violation, or return silently."""
    validator = Draft202012Validator(report_schema())
    errors = sorted(validator.iter_errors(report), key=lambda e: list(e.absolute_path))
    if errors:
        lines = [
            f"  at /{'/'.join(str(p) for p in e.absolute_path)}: {e.message}"
            for e in errors
        ]
        raise ReportValidationError(
            "report does not conform to report.schema.json:\n" + "\n".join(lines)
        )
