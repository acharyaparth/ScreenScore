"""Scoring a completed eval run against ground truth.

Judgment-quality metrics rank candidates; reliability metrics are gates.
Everything here is computed from report JSON + the corpus manifest — the
frontier-judge and human A/B layers live outside this module.
"""

import re

SCORE_RANK = {None: None, "weak": 0, "fair": 1, "good": 2, "excellent": 3}
RATING_LADDER = ["G", "PG", "PG-13", "R", "NC-17"]
BUDGET_LADDER = ["micro", "low", "mid", "studio", "tentpole"]


def spine_score(logline: str, spine_groups: list[list[str]]) -> float:
    """Fraction of spine groups the logline actually names."""
    if not spine_groups:
        return float("nan")
    text = logline.lower()
    hit = sum(1 for group in spine_groups if any(term in text for term in group))
    return hit / len(spine_groups)


def _ladder_match(value: str, truth: str, ladder: list[str]) -> float:
    """1.0 exact, 0.5 adjacent on the ladder, else 0."""
    value, truth = value.strip(), truth.strip()
    if value.upper() == truth.upper():
        return 1.0
    try:
        upper = [x.upper() for x in ladder]
        distance = abs(upper.index(value.upper()) - upper.index(truth.upper()))
        return 0.5 if distance == 1 else 0.0
    except ValueError:
        return 0.0


def rating_score(report: dict, truth: dict) -> float:
    if not truth.get("rating"):
        return float("nan")
    return _ladder_match(report["content_rating"]["estimated"], truth["rating"], RATING_LADDER)


def budget_score(report: dict, truth: dict) -> float:
    if not truth.get("budget_tier"):
        return float("nan")
    return _ladder_match(report["budget_tier"]["tier"], truth["budget_tier"], BUDGET_LADDER)


def comps_score(report: dict, truth: dict) -> float:
    acceptable = truth.get("acceptable_comps")
    if not acceptable:
        return float("nan")
    comps = [c["title"].lower() for c in report["comps"]["items"]]
    if not comps:
        return 0.0
    return sum(1 for c in comps if any(a in c or c in a for a in acceptable)) / len(comps)


def dimension_score(report: dict, dim_id: str):
    for dim in report["rubric"]:
        if dim["id"] == dim_id:
            return dim
    return None


def defect_pair_score(clean_report: dict, damaged_report: dict, target_dim: str) -> float:
    """The damaged variant is worse by construction on target_dim.
    1.0 = scored strictly lower; 0.5 = equal; 0.0 = scored HIGHER (failure).
    Content-rating defects compare the rating ladder instead of a dimension."""
    if target_dim == "content_rating":
        upper = [x.upper() for x in RATING_LADDER]
        try:
            clean_i = upper.index(clean_report["content_rating"]["estimated"].upper())
            damaged_i = upper.index(damaged_report["content_rating"]["estimated"].upper())
        except ValueError:
            return 0.0
        return 1.0 if damaged_i > clean_i else (0.5 if damaged_i == clean_i else 0.0)
    clean = dimension_score(clean_report, target_dim)
    damaged = dimension_score(damaged_report, target_dim)
    if clean is None or damaged is None:
        return 0.0
    clean_rank = SCORE_RANK.get(clean["score"])
    damaged_rank = SCORE_RANK.get(damaged["score"])
    if damaged_rank is None:  # damaged became unscoreable: acceptable half-credit
        return 0.5
    if clean_rank is None:
        return 0.0  # couldn't score the CLEAN draft — that's a model failure
    if damaged_rank < clean_rank:
        return 1.0
    if damaged_rank == clean_rank:
        return 0.5
    return 0.0


def trap_score(report: dict, target_dim: str) -> float:
    """1.0 if the model withheld the score on the starved dimension."""
    dim = dimension_score(report, target_dim)
    if dim is None:
        return 0.0
    return 1.0 if dim["insufficient_evidence"] else 0.0


VERIFY_RE = re.compile(
    r"(\d+) citations checked: (\d+) verified, (\d+) relocated[^,]*, (\d+) dropped"
)


def verify_stats_from_events(events: list[dict]) -> dict | None:
    """Parse the verification summary out of the progress event stream."""
    for event in events:
        detail = event.get("detail") or ""
        match = VERIFY_RE.search(detail)
        if match:
            checked, kept, relocated, dropped = map(int, match.groups())
            return {
                "checked": checked, "kept": kept,
                "relocated": relocated, "dropped": dropped,
                "integrity": kept / checked if checked else None,
            }
    return None


def score_flip_rate(reports: list[dict]) -> float | None:
    """Across N runs of the same input: fraction of dimensions whose
    categorical score is not unanimous."""
    if len(reports) < 2:
        return None
    flips = total = 0
    dim_ids = [d["id"] for d in reports[0]["rubric"]]
    for dim_id in dim_ids:
        scores = {(dimension_score(r, dim_id) or {}).get("score") for r in reports}
        total += 1
        if len(scores) > 1:
            flips += 1
    return flips / total if total else None
