"""Screenplay parsing: PDF / TXT / Fountain / FDX → structured scenes."""

from .models import (
    PARSER_VERSION,
    CharacterStats,
    Element,
    ElementType,
    ParsedScreenplay,
    Scene,
)


def parse_bytes(data: bytes, source_format: str) -> ParsedScreenplay:
    """Single entry point used by the app; source_format ∈ pdf|txt|fountain|fdx."""
    if source_format == "fountain":
        from .fountain import parse_fountain

        return parse_fountain(data.decode("utf-8", errors="replace"))
    if source_format == "fdx":
        from .fdx import parse_fdx

        return parse_fdx(data)
    if source_format == "pdf":
        from .pdf import parse_pdf

        return parse_pdf(data)
    if source_format == "txt":
        from .text import parse_text

        return parse_text(data.decode("utf-8", errors="replace"))
    raise ValueError(f"unknown source format: {source_format}")


__all__ = [
    "PARSER_VERSION",
    "CharacterStats",
    "Element",
    "ElementType",
    "ParsedScreenplay",
    "Scene",
    "parse_bytes",
]
