"""Heuristic parser for plain-text screenplays — and for text extracted from
PDFs, which is where scripts get genuinely messy: page numbers, (CONTINUED)/
(MORE) furniture, margin scene numbers, OCR-flattened indentation.

Strategy:
1. Strip page furniture.
2. Profile indentation: production-formatted scripts put dialogue ~10 chars
   and character cues ~20 chars right of the action margin. When the file is
   flat (no meaningful indentation), fall back to Fountain-style blank-line
   rules.
3. Classify line-by-line: slugline / transition / character cue → dialogue /
   parenthetical / action.
"""

import re
from collections import Counter

from .models import (
    Element,
    ElementType,
    ParsedScreenplay,
    Scene,
    normalize_character_cue,
    parse_slugline,
)

# Scene numbers in shooting scripts: 12, 12A, A12, 12B — letter prefixes mark
# inserted scenes and are common in production drafts.
SLUG_RE = re.compile(
    r"^(?:(?P<pre_num>[A-Z]?\d+[A-Z]?)[.)]?\s+)?"
    r"(?P<slug>(INT|EXT|EST|I/E|INT\.?\s?/\s?EXT|EXT\.?\s?/\s?INT)[.\s:].*?)"
    r"(?:\s+(?P<post_num>[A-Z]?\d+[A-Z]?))?\s*$",
    re.IGNORECASE,
)
PAGE_NUMBER_RE = re.compile(r"^\s*-?\s*(page\s+)?\d+[A-Za-z]?\s*[-.]?\s*$", re.IGNORECASE)
FURNITURE_RE = re.compile(r"^\s*\(?\s*(CONTINUED|MORE)\s*\)?\s*[:.]?\s*$", re.IGNORECASE)
KNOWN_TRANSITIONS = re.compile(
    r"^(FADE (IN|OUT|TO BLACK)|CUT TO BLACK|(SMASH |MATCH |HARD |JUMP )?CUT TO|DISSOLVE TO|"
    r"WIPE TO|IRIS (IN|OUT)|TIME CUT|INTERCUT( WITH)?)\s*[:.]?$"
)


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _is_upper(text: str) -> bool:
    return text == text.upper() and any(ch.isalpha() for ch in text)


def _is_transition(stripped: str) -> bool:
    return _is_upper(stripped) and (
        bool(KNOWN_TRANSITIONS.match(stripped)) or stripped.endswith("TO:")
    )


def _looks_like_cue(stripped: str) -> bool:
    if not _is_upper(stripped) or len(stripped) > 45:
        return False
    if SLUG_RE.match(stripped) or _is_transition(stripped):
        return False
    if stripped.endswith(("!", "?", ":")):
        return False  # shouty action ("BANG!") or heading, not a name
    if stripped.endswith(".") and not stripped.endswith((".)", "'D.")):
        return False
    return True


def parse_text(text: str, source_format: str = "txt", page_count: int | None = None) -> ParsedScreenplay:
    text = text.replace("\r\n", "\n").replace("\r", "\n").expandtabs(4)
    lines = [
        line
        for line in text.split("\n")
        if not PAGE_NUMBER_RE.match(line) and not FURNITURE_RE.match(line)
    ]

    result = ParsedScreenplay(
        source_format=source_format, title=None, authors=[], scenes=[], page_count=page_count
    )

    action_indent, dialogue_min_indent, has_layout = _profile_indentation(lines)

    scene: Scene | None = None
    preamble: list[str] = []
    raw: list[str] = []
    i, n = 0, len(lines)

    def flush_raw() -> None:
        nonlocal raw
        if scene is not None:
            scene.raw_text = "\n".join(raw).strip()
        raw = []

    while i < n:
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            (raw if scene else preamble).append(line)
            i += 1
            continue

        slug_match = SLUG_RE.match(stripped)
        if slug_match and _is_upper(slug_match.group("slug")[:4].strip()):
            flush_raw()
            slug = slug_match.group("slug").strip()
            int_ext, location, time_of_day = parse_slugline(slug)
            scene = Scene(
                number=len(result.scenes) + 1,
                slugline=slug,
                int_ext=int_ext,
                location=location,
                time_of_day=time_of_day,
                source_scene_number=slug_match.group("pre_num") or slug_match.group("post_num"),
            )
            result.scenes.append(scene)
            raw = [slug]
            i += 1
            continue

        (raw if scene else preamble).append(line)

        if _is_transition(stripped):
            if scene:
                scene.elements.append(Element(ElementType.TRANSITION, stripped))
            i += 1
            continue

        is_cue = _looks_like_cue(stripped)
        if is_cue and has_layout:
            # In layout mode a cue must sit clearly right of the action margin.
            is_cue = _indent(line) >= dialogue_min_indent
        if is_cue:
            # Must actually be followed by dialogue.
            has_dialogue_next = i + 1 < n and lines[i + 1].strip()
            if has_layout and has_dialogue_next:
                has_dialogue_next = _indent(lines[i + 1]) > action_indent
            if has_dialogue_next:
                character, dual = normalize_character_cue(stripped)
                i += 1
                while i < n and lines[i].strip():
                    if has_layout and _indent(lines[i]) <= action_indent:
                        break  # back at the action margin: dialogue block over
                    speech = lines[i].strip()
                    (raw if scene else preamble).append(lines[i])
                    if scene:
                        element_type = (
                            ElementType.PARENTHETICAL
                            if speech.startswith("(") and speech.endswith(")")
                            else ElementType.DIALOGUE
                        )
                        scene.elements.append(
                            Element(element_type, speech, character=character, dual=dual)
                        )
                    i += 1
                continue

        if scene:
            scene.elements.append(Element(ElementType.ACTION, stripped))
        i += 1

    flush_raw()
    result.preamble = "\n".join(preamble).strip()

    if not result.scenes:
        result.warnings.append("no sluglines found — file may not be a screenplay")
    elif not any(
        e.type == ElementType.DIALOGUE for s in result.scenes for e in s.elements
    ):
        result.warnings.append("no dialogue detected — check formatting assumptions")
    return result


def _profile_indentation(lines: list[str]) -> tuple[int, int, bool]:
    """Returns (action_indent, dialogue_min_indent, has_layout).

    has_layout is False for flat files (plain exports, some OCR), in which
    case callers use blank-line rules instead of indentation.
    """
    indents = Counter(
        _indent(line) for line in lines if line.strip() and _indent(line) < 60
    )
    if not indents:
        return 0, 0, False
    action_indent = indents.most_common(1)[0][0]
    deeper = [ind for ind in indents if ind >= action_indent + 4]
    has_layout = sum(indents[d] for d in deeper) >= max(3, 0.05 * sum(indents.values()))
    dialogue_min_indent = action_indent + 4 if has_layout else 0
    return action_indent, dialogue_min_indent, has_layout
