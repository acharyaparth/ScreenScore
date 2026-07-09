"""Evidence verification — the mechanical enforcement of the traceability bar.

Every citation the models produced is checked against the parsed script:
1. cited scene exists and contains the quote (normalized) → kept;
2. quote found in a DIFFERENT scene → scene number corrected, noted;
3. quote found nowhere → dropped.
A scored rubric dimension whose evidence all drops loses its score and
becomes insufficient_evidence: a score we cannot ground is a score we do not
publish. The same normalization is deliberately forgiving about whitespace,
case and curly quotes, and strict about words.
"""

import re
from dataclasses import dataclass, field

MIN_QUOTE_CHARS = 8          # floor for any quote (full-line matches)
MIN_FRAGMENT_CHARS = 12      # floor for a partial-line quote
MIN_LINE_COVERAGE = 0.6      # a partial quote must cover ≥60% of its line
MIN_ANCHOR_LINE_CHARS = 4    # lines shorter than this can't anchor a match


@dataclass
class VerificationStats:
    checked: int = 0
    kept: int = 0
    relocated: int = 0
    dropped: int = 0
    ambiguous: int = 0  # dropped because the quote appears in multiple scenes
    dimensions_downgraded: list[str] = field(default_factory=list)
    verdict_adjusted: str | None = None

    def summary(self) -> str:
        parts = (
            f"{self.checked} citations checked: {self.kept} verified, "
            f"{self.relocated} relocated to the correct scene, {self.dropped} dropped"
        )
        if self.ambiguous:
            parts += f" ({self.ambiguous} ambiguous across scenes)"
        return parts


def _normalize(text: str) -> str:
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = re.sub(r"\s+", " ", text)
    return text.strip().strip('"').strip().lower()


class EvidenceVerifier:
    def __init__(self, parsed: dict) -> None:
        self._scene_texts: dict[int, str] = {}
        self._scene_lines: dict[int, list[str]] = {}
        for scene in parsed["scenes"]:
            raw = scene.get("raw_text") or ""
            self._scene_texts[scene["number"]] = _normalize(raw)
            self._scene_lines[scene["number"]] = [
                normalized
                for line in raw.splitlines()
                if len(normalized := _normalize(line)) >= MIN_ANCHOR_LINE_CHARS
            ]
        self.stats = VerificationStats()

    def scene_exists(self, number: int) -> bool:
        return number in self._scene_texts

    def _matches_scene(self, quote: str, number: int) -> bool:
        """Anchored match: substring presence alone is not enough — a quote
        must contain at least one full line of the scene, or cover most of a
        single line. This is what stops cropped fragments ('cannot breathe')
        from passing as citations of longer lines."""
        if quote not in self._scene_texts.get(number, ""):
            return False
        for line in self._scene_lines.get(number, []):
            if line in quote:
                return True  # quote spans (at least) one complete line
            if (
                quote in line
                and len(quote) >= MIN_FRAGMENT_CHARS
                and len(quote) >= MIN_LINE_COVERAGE * len(line)
            ):
                return True  # partial quote, but most of that line
        return False

    def check(self, evidence: dict) -> dict | None:
        """Returns the (possibly corrected) evidence item, or None to drop."""
        self.stats.checked += 1
        scene_number = evidence.get("scene_number")
        quote = _normalize(str(evidence.get("quote") or ""))
        if len(quote) < MIN_QUOTE_CHARS:
            self.stats.dropped += 1
            return None
        if isinstance(scene_number, int) and self._matches_scene(quote, scene_number):
            return self._kept(evidence)
        # Models often cite the right line with the wrong number — but only
        # relocate when the destination is unambiguous. A quote that appears
        # in several scenes cannot be silently reattributed.
        matches = [n for n in self._scene_texts if self._matches_scene(quote, n)]
        if len(matches) == 1:
            self.stats.relocated += 1
            return {
                **evidence,
                "scene_number": matches[0],
                "note": (evidence.get("note") or None)
                or f"citation corrected: quote found in scene {matches[0]}, not {scene_number}",
            }
        if len(matches) > 1:
            self.stats.ambiguous += 1
        self.stats.dropped += 1
        return None

    def _kept(self, evidence: dict) -> dict:
        self.stats.kept += 1
        return evidence

    def check_list(self, evidence_list: list[dict]) -> list[dict]:
        return [checked for e in evidence_list if (checked := self.check(e)) is not None]

    # -- section-level passes -------------------------------------------------

    def verify_rubric(self, rubric: list[dict]) -> list[dict]:
        for dim in rubric:
            dim["evidence"] = self.check_list(dim.get("evidence") or [])
            if not dim.get("insufficient_evidence") and not dim["evidence"]:
                dim["insufficient_evidence"] = True
                dim["score"] = None
                dim["rationale"] = (
                    dim.get("rationale", "").rstrip()
                    + " [Score withheld: no citation could be verified against the script.]"
                ).strip()
                self.stats.dimensions_downgraded.append(dim["id"])
        return rubric

    def verify_scene_notes(self, notes: list[dict]) -> list[dict]:
        kept = []
        for note in notes:
            if not self.scene_exists(note.get("scene_number", -1)):
                self.stats.dropped += 1
                continue
            note["evidence"] = self.check_list(note.get("evidence") or [])
            kept.append(note)
        return kept

    def verify_rating_drivers(self, drivers: list[dict]) -> list[dict]:
        for driver in drivers:
            driver["evidence"] = self.check_list(driver.get("evidence") or [])
        return drivers


SCORE_RANK = {"weak": 0, "fair": 1, "good": 2, "excellent": 3}


def consistent_verdict(verdict: str, rubric: list[dict], stats: VerificationStats) -> str:
    """Soft guard: the executive verdict may not contradict the scored parts.

    Never upgrades to recommend and never downgrades to pass on its own —
    it only pulls contradictions back to 'consider'.
    """
    scores = [d["score"] for d in rubric if d.get("score")]
    if not scores:
        if verdict == "recommend":
            stats.verdict_adjusted = "recommend→consider (no verifiable scores)"
            return "consider"
        return verdict
    weak = sum(1 for s in scores if s == "weak")
    strong = sum(1 for s in scores if s in ("good", "excellent"))
    if verdict == "recommend" and weak >= max(2, len(scores) // 3):
        stats.verdict_adjusted = "recommend→consider (too many weak dimensions)"
        return "consider"
    if verdict == "pass" and weak == 0 and strong >= len(scores) * 0.6:
        stats.verdict_adjusted = "pass→consider (scores are mostly good or better)"
        return "consider"
    return verdict
