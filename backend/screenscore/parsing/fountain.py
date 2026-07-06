"""Fountain (.fountain) parser.

Implements the working subset of the Fountain spec that matters for coverage:
title page, sluglines (including forced '.'), character cues (including
forced '@', extensions, dual-dialogue '^'), dialogue, parentheticals,
transitions (including forced '>'), centered text, and removal of boneyards
/* … */, notes [[ … ]], sections (#) and synopses (=).

Not implemented (recorded as non-goals for coverage purposes): emphasis
rendering (markup passes through as text), lyrics (~) beyond treating them as
dialogue/action text, dual-dialogue column layout (we keep the '^' flag).
"""

import re

from .models import (
    Element,
    ElementType,
    ParsedScreenplay,
    Scene,
    normalize_character_cue,
    parse_slugline,
)

SLUG_RE = re.compile(r"^(INT|EXT|EST|INT\.?/\s?EXT|EXT\.?/\s?INT|I/E)[.\s]", re.IGNORECASE)
SCENE_NUMBER_RE = re.compile(r"#([A-Za-z0-9.\-]+)#\s*$")
TRANSITION_RE = re.compile(r"^[A-Z0-9 .'\-]+TO:$")
CENTERED_RE = re.compile(r"^>\s*(.*?)\s*<$")
PAGE_BREAK_RE = re.compile(r"^===+\s*$")
TITLE_KEY_RE = re.compile(r"^([A-Za-z][A-Za-z ]*):\s*(.*)$")

BONEYARD_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
NOTE_RE = re.compile(r"\[\[.*?\]\]", re.DOTALL)


def _is_upper(text: str) -> bool:
    return text == text.upper() and any(ch.isalpha() for ch in text)


def _looks_like_cue(line: str) -> bool:
    stripped = line.strip()
    if stripped.startswith("@"):
        return True
    if not _is_upper(stripped):
        return False
    # Reject things that are clearly not names: sluglines and transitions.
    if SLUG_RE.match(stripped) or TRANSITION_RE.match(stripped.rstrip("^").strip()):
        return False
    return len(stripped) <= 60


def parse_fountain(text: str) -> ParsedScreenplay:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = BONEYARD_RE.sub("", text)
    text = NOTE_RE.sub("", text)
    lines = text.split("\n")

    title, authors, body_start = _parse_title_page(lines)
    # Drop sections (#) and synopses (=) here so they don't break the
    # blank-line adjacency that slugline/cue detection relies on. ('===' is a
    # page break, kept as vertical space.)
    lines = [
        line
        for line in lines[body_start:]
        if not (
            line.strip().startswith("#")
            or (line.strip().startswith("=") and not PAGE_BREAK_RE.match(line.strip()))
        )
    ]

    result = ParsedScreenplay(
        source_format="fountain", title=title, authors=authors, scenes=[]
    )

    scene: Scene | None = None
    preamble_lines: list[str] = []
    raw_lines: list[str] = []
    i = 0

    def flush_raw() -> None:
        nonlocal raw_lines
        if scene is not None:
            scene.raw_text = "\n".join(raw_lines).strip()
        raw_lines = []

    def blank_before(index: int) -> bool:
        return index == 0 or not lines[index - 1].strip()

    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.strip()

        if not stripped or PAGE_BREAK_RE.match(stripped):
            (raw_lines if scene else preamble_lines).append(line)
            i += 1
            continue

        forced_slug = stripped.startswith(".") and len(stripped) > 1 and not stripped.startswith("..")
        natural_slug = bool(SLUG_RE.match(stripped)) and blank_before(i)
        if forced_slug or natural_slug:
            flush_raw()
            slug = stripped[1:].strip() if forced_slug else stripped
            source_number = None
            if match := SCENE_NUMBER_RE.search(slug):
                source_number = match.group(1)
                slug = slug[: match.start()].strip()
            int_ext, location, time_of_day = parse_slugline(slug)
            scene = Scene(
                number=len(result.scenes) + 1,
                slugline=slug,
                int_ext=int_ext,
                location=location,
                time_of_day=time_of_day,
                source_scene_number=source_number,
            )
            result.scenes.append(scene)
            raw_lines = [slug]
            i += 1
            continue

        container = scene.elements if scene else None
        target_raw = raw_lines if scene else preamble_lines
        target_raw.append(line)

        if centered := CENTERED_RE.match(stripped):
            if container is not None:
                container.append(Element(ElementType.CENTERED, centered.group(1)))
            i += 1
            continue

        forced_transition = stripped.startswith(">")
        natural_transition = (
            TRANSITION_RE.match(stripped)
            and blank_before(i)
            and (i + 1 >= n or not lines[i + 1].strip())
        )
        if forced_transition or natural_transition:
            transition_text = stripped[1:].strip() if forced_transition else stripped
            if container is not None:
                container.append(Element(ElementType.TRANSITION, transition_text))
            i += 1
            continue

        if _looks_like_cue(stripped) and blank_before(i) and i + 1 < n and lines[i + 1].strip():
            cue = stripped[1:] if stripped.startswith("@") else stripped
            character, dual = normalize_character_cue(cue)
            i += 1
            while i < n and lines[i].strip():
                dialogue_line = lines[i].strip()
                target_raw.append(lines[i])
                if container is not None:
                    if dialogue_line.startswith("(") and dialogue_line.endswith(")"):
                        container.append(
                            Element(ElementType.PARENTHETICAL, dialogue_line, character=character, dual=dual)
                        )
                    else:
                        container.append(
                            Element(ElementType.DIALOGUE, dialogue_line, character=character, dual=dual)
                        )
                i += 1
            continue

        if container is not None:
            forced_action = stripped.startswith("!")
            container.append(Element(ElementType.ACTION, stripped[1:] if forced_action else stripped))
        i += 1

    flush_raw()
    result.preamble = "\n".join(preamble_lines).strip()
    if not result.scenes:
        result.warnings.append("no sluglines found — file may not be a screenplay")
    return result


KNOWN_TITLE_KEYS = {
    "title", "credit", "author", "authors", "written by", "source",
    "draft date", "date", "contact", "copyright", "notes", "revision",
}


def _parse_title_page(lines: list[str]) -> tuple[str | None, list[str], int]:
    """Returns (title, authors, index where the body starts)."""
    title = None
    authors: list[str] = []
    i = 0
    current_key = None
    saw_any_key = False
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            if saw_any_key:
                i += 1
            break
        match = TITLE_KEY_RE.match(line)
        if match and not line.startswith((" ", "\t")):
            key = match.group(1).strip().lower()
            # The first line decides whether this is a title page at all —
            # otherwise "FADE IN:" would be eaten as a metadata key.
            if not saw_any_key and key not in KNOWN_TITLE_KEYS:
                return None, [], 0
            saw_any_key = True
            current_key = key
            value = match.group(2).strip()
            if value:
                if current_key == "title":
                    title = value
                elif current_key in ("author", "authors", "written by"):
                    authors.extend(_split_authors(value))
        elif saw_any_key and line.startswith((" ", "\t")) and current_key:
            value = line.strip()
            if current_key == "title":
                title = f"{title} {value}".strip() if title else value
            elif current_key in ("author", "authors", "written by"):
                authors.extend(_split_authors(value))
        else:
            break  # not a title page at all
        i += 1
    if not saw_any_key:
        return None, [], 0
    return title, authors, i


def _split_authors(value: str) -> list[str]:
    parts = re.split(r"\s+and\s+|\s*&\s*|\s*,\s*", value)
    return [p.strip() for p in parts if p.strip()]
