"""Final Draft (.fdx) parser.

FDX is XML with typed <Paragraph> elements, so unlike the text formats this
parser mostly trusts the file's own structure. stdlib ElementTree only.
"""

import xml.etree.ElementTree as ET

from .models import (
    Element,
    ElementType,
    ParsedScreenplay,
    Scene,
    normalize_character_cue,
    parse_slugline,
)

TYPE_MAP = {
    "Action": ElementType.ACTION,
    "General": ElementType.ACTION,
    "Dialogue": ElementType.DIALOGUE,
    "Parenthetical": ElementType.PARENTHETICAL,
    "Transition": ElementType.TRANSITION,
}


def parse_fdx(data: bytes) -> ParsedScreenplay:
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        result = ParsedScreenplay(source_format="fdx", title=None, authors=[], scenes=[])
        result.warnings.append(f"not valid FDX/XML: {exc}")
        return result

    result = ParsedScreenplay(
        source_format="fdx",
        title=_title_page_value(root, "Title"),
        authors=_split_authors(_title_page_value(root, "Author") or ""),
        scenes=[],
    )

    content = root.find("Content")
    if content is None:
        result.warnings.append("FDX file has no <Content> element")
        return result

    scene: Scene | None = None
    preamble: list[str] = []
    raw: list[str] = []
    current_character: str | None = None
    current_dual = False

    def flush_raw() -> None:
        nonlocal raw
        if scene is not None:
            scene.raw_text = "\n".join(raw).strip()
        raw = []

    for paragraph in content.iter("Paragraph"):
        ptype = paragraph.get("Type", "Action")
        text = _paragraph_text(paragraph)
        if not text.strip() and ptype != "Scene Heading":
            continue

        if ptype == "Scene Heading":
            flush_raw()
            slug = text.strip()
            int_ext, location, time_of_day = parse_slugline(slug)
            scene = Scene(
                number=len(result.scenes) + 1,
                slugline=slug,
                int_ext=int_ext,
                location=location,
                time_of_day=time_of_day,
                source_scene_number=paragraph.get("Number"),
            )
            result.scenes.append(scene)
            raw = [slug]
            current_character = None
            continue

        (raw if scene else preamble).append(text)

        if ptype == "Character":
            current_character, current_dual = normalize_character_cue(text)
            # Final Draft marks the second column of a dual-dialogue pair.
            if paragraph.find("DualDialogue") is not None:
                current_dual = True
            continue

        if scene is None:
            continue
        element_type = TYPE_MAP.get(ptype)
        if element_type is None:
            continue  # Shot, Cast List, New Act, etc. — not coverage-relevant
        if element_type in (ElementType.DIALOGUE, ElementType.PARENTHETICAL):
            scene.elements.append(
                Element(element_type, text.strip(), character=current_character, dual=current_dual)
            )
        else:
            scene.elements.append(Element(element_type, text.strip()))
            current_character = None

    flush_raw()
    result.preamble = "\n".join(preamble).strip()
    if not result.scenes:
        result.warnings.append("no Scene Heading paragraphs found")
    return result


def _paragraph_text(paragraph: ET.Element) -> str:
    return "".join(t.text or "" for t in paragraph.iter("Text"))


def _title_page_value(root: ET.Element, wanted: str) -> str | None:
    # Try the conventional TitlePage layout first…
    for paragraph in root.iterfind(".//TitlePage//Paragraph"):
        text = _paragraph_text(paragraph).strip()
        if text.lower().startswith(wanted.lower() + ":"):
            return text.split(":", 1)[1].strip() or None
    # …then Final Draft's key/value <TitlePage> variant.
    for element in root.iterfind(f".//TitlePage//{wanted}"):
        if element.text and element.text.strip():
            return element.text.strip()
    if wanted == "Title":
        # First non-empty centered title-page paragraph is usually the title.
        for paragraph in root.iterfind(".//TitlePage//Paragraph"):
            text = _paragraph_text(paragraph).strip()
            if text and ":" not in text:
                return text
    return None


def _split_authors(value: str) -> list[str]:
    import re

    parts = re.split(r"\s+and\s+|\s*&\s*|\s*,\s*", value)
    return [p.strip() for p in parts if p.strip()]
