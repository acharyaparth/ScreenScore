"""Targeted retrieval: deterministic per-dimension context packs."""

from screenscore.pipeline.digest import build_structure
from screenscore.pipeline.retrieval import (
    char_budget,
    content_scan,
    dimension_context,
    production_table,
)

PARSED = {
    "scenes": [
        {
            "number": 1, "slugline": "INT. BAR - NIGHT", "int_ext": "INT",
            "location": "BAR", "time_of_day": "NIGHT",
            "raw_text": "INT. BAR - NIGHT\n\nRAY nurses a whiskey. A fight breaks out; someone pulls a gun.",
            "elements": [
                {"type": "action", "text": "RAY nurses a whiskey. A fight breaks out; someone pulls a gun.", "character": None},
                {"type": "dialogue", "text": "Put it down before somebody gets killed.", "character": "RAY"},
            ],
        },
        {
            "number": 2, "slugline": "EXT. DOCK - NIGHT", "int_ext": "EXT",
            "location": "DOCK", "time_of_day": "NIGHT",
            "raw_text": "EXT. DOCK - NIGHT\n\nAn explosion rips through a warehouse. Ray runs.",
            "elements": [
                {"type": "action", "text": "An explosion rips through a warehouse. Ray runs.", "character": None},
                {"type": "dialogue", "text": "Go, go, go!", "character": "RAY"},
                {"type": "dialogue", "text": "This is on you, Ray.", "character": "MARA"},
            ],
        },
        {
            "number": 3, "slugline": "INT. BAR - DAY", "int_ext": "INT",
            "location": "BAR", "time_of_day": "DAY",
            "raw_text": "INT. BAR - DAY\n\nMorning light. Ray sweeps broken glass.",
            "elements": [
                {"type": "action", "text": "Morning light. Ray sweeps broken glass.", "character": None},
                {"type": "dialogue", "text": "We open at noon like nothing happened.", "character": "RAY"},
            ],
        },
    ]
}


def test_char_budget_scales_with_context():
    assert char_budget(8192) > char_budget(4096)
    assert char_budget(2048) >= 6000  # floor


def test_content_scan_finds_verbatim_lines_with_scene_numbers():
    scan = content_scan(PARSED)
    assert (1, "RAY nurses a whiskey. A fight breaks out; someone pulls a gun.") in scan["substances"]
    assert any(n == 1 for n, _ in scan["violence"])  # 'gun', 'killed'
    assert scan["sexual_content"] == []


def test_production_table_counts():
    table = production_table(PARSED)
    assert "2 distinct locations" in table
    assert "2 INT / 1 EXT" in table
    assert "1 night/dusk exteriors" in table
    assert "explosion" in table.lower()  # effects flag with verbatim line


def test_dimension_contexts_are_dimension_specific():
    structure = build_structure(PARSED)
    contexts = {
        dim: dimension_context(dim, PARSED, structure, 4000)
        for dim in ("structure_pacing", "characterization", "dialogue",
                    "production_complexity", "representation_content", "theme_resonance")
    }
    assert "Longest scenes" in contexts["structure_pacing"]
    assert "first appears SC 1" in contexts["characterization"]
    assert "SCENE 2" in contexts["dialogue"]  # most dialogue-dense scene
    assert "distinct locations" in contexts["production_complexity"]
    assert "Speaking cast" in contexts["representation_content"]
    # bookends: opening + ending scenes
    assert "SCENE 1" in contexts["theme_resonance"] and "SCENE 3" in contexts["theme_resonance"]


def test_dimension_context_respects_budget():
    structure = build_structure(PARSED)
    assert len(dimension_context("characterization", PARSED, structure, 300)) <= 300


def test_unknown_dimension_gets_empty_pack():
    structure = build_structure(PARSED)
    assert dimension_context("brand_new_dimension", PARSED, structure, 4000) == ""
