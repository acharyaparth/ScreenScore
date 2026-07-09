"""The structured internal representation every parser produces.

Design constraints (from the brief):
- Keep raw text alongside structure so the UI can highlight evidence against
  the original script.
- Scenes are the unit of citation: every downstream score cites scene numbers,
  so scene segmentation must be stable and 1-based.
- Real scripts are messy; parsers record diagnostics as warnings instead of
  refusing to parse.
"""

from dataclasses import asdict, dataclass, field
from enum import StrEnum

# Bump when parser behavior changes in a way that alters output; part of the
# pipeline cache key so stale parses are never reused.
# 3: action margin = smallest frequent indent (dialogue-heavy PDFs mis-profiled)
# 2: A-prefix scene numbers (A12) recognized in sluglines
PARSER_VERSION = "3"

# Extensions that decorate a character cue without changing identity.
CUE_EXTENSIONS = ("V.O.", "O.S.", "O.C.", "CONT'D", "CONT’D", "CONTD", "VOICE", "ON PHONE", "PRE-LAP")


class ElementType(StrEnum):
    ACTION = "action"
    DIALOGUE = "dialogue"
    PARENTHETICAL = "parenthetical"
    TRANSITION = "transition"
    CENTERED = "centered"


@dataclass
class Element:
    type: ElementType
    text: str
    # Set on DIALOGUE and PARENTHETICAL: the normalized speaking character.
    character: str | None = None
    # True when this cue was marked for dual (simultaneous) dialogue.
    dual: bool = False


@dataclass
class Scene:
    number: int  # 1-based, in script order
    slugline: str  # as written, e.g. "INT. LIGHTHOUSE - NIGHT"
    int_ext: str | None  # "INT" | "EXT" | "INT/EXT" | None (unparseable)
    location: str | None
    time_of_day: str | None
    elements: list[Element] = field(default_factory=list)
    raw_text: str = ""  # slugline + body as it appeared in the source
    # Scene number printed in the source (shooting scripts), e.g. "12A".
    source_scene_number: str | None = None

    def dialogue_lines(self, character: str | None = None) -> list[str]:
        return [
            e.text
            for e in self.elements
            if e.type == ElementType.DIALOGUE and (character is None or e.character == character)
        ]

    def characters_present(self) -> list[str]:
        seen: dict[str, None] = {}
        for e in self.elements:
            if e.type == ElementType.DIALOGUE and e.character:
                seen.setdefault(e.character)
        return list(seen)


@dataclass
class CharacterStats:
    name: str
    dialogue_line_count: int
    scene_numbers: list[int]


@dataclass
class ParsedScreenplay:
    source_format: str  # pdf | txt | fountain | fdx
    title: str | None
    authors: list[str]
    scenes: list[Scene]
    # Anything before the first slugline (FADE IN:, title cards, …).
    preamble: str = ""
    # True page count for PDFs; None elsewhere (estimate separately).
    page_count: int | None = None
    warnings: list[str] = field(default_factory=list)

    def characters(self) -> list[CharacterStats]:
        """Speaking characters aggregated across scenes, most dialogue first."""
        stats: dict[str, CharacterStats] = {}
        for scene in self.scenes:
            for element in scene.elements:
                if element.type != ElementType.DIALOGUE or not element.character:
                    continue
                entry = stats.setdefault(
                    element.character, CharacterStats(element.character, 0, [])
                )
                entry.dialogue_line_count += 1
                if not entry.scene_numbers or entry.scene_numbers[-1] != scene.number:
                    entry.scene_numbers.append(scene.number)
        return sorted(stats.values(), key=lambda c: -c.dialogue_line_count)

    def estimated_page_count(self) -> int | None:
        """True count for PDFs; otherwise the industry ~55-lines-per-page rule."""
        if self.page_count:
            return self.page_count
        lines = sum(scene.raw_text.count("\n") + 1 for scene in self.scenes)
        lines += self.preamble.count("\n")
        return max(1, round(lines / 55)) if lines else None

    def as_dict(self) -> dict:
        return asdict(self)


def normalize_character_cue(cue: str) -> tuple[str, bool]:
    """'MARA (V.O.) (CONT'D) ^' → ('MARA', dual=True).

    Strips extensions and dual-dialogue markers so the same person aggregates
    under one name.
    """
    name = cue.strip()
    dual = name.endswith("^")
    if dual:
        name = name[:-1].strip()
    while name.endswith(")") and "(" in name:
        name = name[: name.rindex("(")].strip()
    return name.rstrip(":").strip(), dual


def parse_slugline(slugline: str) -> tuple[str | None, str | None, str | None]:
    """'INT. LIGHTHOUSE - NIGHT' → ('INT', 'LIGHTHOUSE', 'NIGHT').

    Returns (int_ext, location, time_of_day), any of which may be None —
    real scripts write sluglines every way imaginable.
    """
    text = slugline.strip().rstrip(".")
    upper = text.upper()

    int_ext = None
    rest = text
    for prefix, canonical in (
        ("INT./EXT.", "INT/EXT"), ("INT/EXT.", "INT/EXT"), ("INT./EXT", "INT/EXT"),
        ("EXT./INT.", "INT/EXT"), ("EXT/INT.", "INT/EXT"), ("INT/EXT", "INT/EXT"),
        ("EXT/INT", "INT/EXT"), ("I/E.", "INT/EXT"), ("I/E", "INT/EXT"),
        ("INT.", "INT"), ("INT ", "INT"), ("EXT.", "EXT"), ("EXT ", "EXT"),
        ("EST.", "EXT"), ("EST ", "EXT"),
    ):
        if upper.startswith(prefix):
            int_ext = canonical
            # lstrip('. ') also cleans OCR artifacts like "INT . LIGHTHOUSE"
            rest = text[len(prefix):].lstrip(". ").strip()
            break

    location: str | None = rest or None
    time_of_day = None
    # Time of day conventionally follows the last " - " (or " – ").
    for sep in (" - ", " – ", " — "):
        if rest and sep in rest:
            location, _, tail = rest.rpartition(sep)
            location = location.strip() or None
            time_of_day = tail.strip() or None
            break
    return int_ext, location, time_of_day
