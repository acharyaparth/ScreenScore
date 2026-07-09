"""Parser corpus tests. The fixtures deliberately carry real-world mess:
page furniture, margin scene numbers, OCR-spaced sluglines, CONT'D cues,
boneyards/notes, forced Fountain elements, dual dialogue.
"""

from pathlib import Path

import pytest

from screenscore.parsing import ElementType, parse_bytes
from screenscore.parsing.models import normalize_character_cue, parse_slugline
from screenscore.parsing.text import parse_text

from pdf_fixture import screenplay_pdf

CORPUS = Path(__file__).parent / "corpus"


# -- fountain -----------------------------------------------------------------

@pytest.fixture(scope="module")
def fountain():
    return parse_bytes((CORPUS / "clean.fountain").read_bytes(), "fountain")


def test_fountain_title_page(fountain):
    assert fountain.title == "The Long Rain"
    assert fountain.authors == ["Jordan Avery", "Sam Kessler"]


def test_fountain_scene_segmentation(fountain):
    assert [s.slugline for s in fountain.scenes] == [
        "EXT. COASTAL HIGHWAY - NIGHT",
        "INT. LIGHTHOUSE - CONTINUOUS",
        "MONTAGE - THE STORM YEARS",  # forced with '.'
        "EXT. LIGHTHOUSE - GALLERY - DAWN",
    ]
    assert [s.number for s in fountain.scenes] == [1, 2, 3, 4]
    assert [s.source_scene_number for s in fountain.scenes] == ["1", "2", None, "3A"]


def test_fountain_slugline_fields(fountain):
    first = fountain.scenes[0]
    assert (first.int_ext, first.location, first.time_of_day) == ("EXT", "COASTAL HIGHWAY", "NIGHT")
    gallery = fountain.scenes[3]
    assert gallery.location == "LIGHTHOUSE - GALLERY"
    assert gallery.time_of_day == "DAWN"
    assert fountain.scenes[2].int_ext is None  # montage


def test_fountain_dialogue_attribution_and_contd_merge(fountain):
    chars = {c.name: c for c in fountain.characters()}
    assert set(chars) == {"MARA", "KEELER"}
    # (V.O.), (CONT'D) and '^' all collapse onto plain MARA
    assert chars["MARA"].dialogue_line_count == 5
    assert chars["MARA"].scene_numbers == [1, 2, 3]
    assert chars["KEELER"].dialogue_line_count == 2
    assert chars["KEELER"].scene_numbers == [3, 4]


def test_fountain_parenthetical_not_counted_as_dialogue(fountain):
    scene2 = fountain.scenes[1]
    parentheticals = [e for e in scene2.elements if e.type == ElementType.PARENTHETICAL]
    assert [p.text for p in parentheticals] == ["(calling up)"]
    assert parentheticals[0].character == "MARA"


def test_fountain_dual_dialogue_flag(fountain):
    montage = fountain.scenes[2]
    dual_lines = [e for e in montage.elements if e.dual]
    assert [e.character for e in dual_lines] == ["MARA"]


def test_fountain_boneyard_and_notes_stripped(fountain):
    everything = "\n".join(s.raw_text for s in fountain.scenes) + fountain.preamble
    assert "sings along" not in everything  # boneyard
    assert "stronger visual hook" not in everything  # note
    assert "ACT ONE" not in everything  # section
    assert "keeper is missing" not in everything  # synopsis


def test_fountain_transitions_and_centered(fountain):
    scene2 = fountain.scenes[1]
    assert any(e.type == ElementType.TRANSITION and e.text == "CUT TO:" for e in scene2.elements)
    montage = fountain.scenes[2]
    assert any(e.type == ElementType.CENTERED and "Three winters" in e.text for e in montage.elements)


def test_fountain_preamble_kept(fountain):
    assert "FADE IN:" in fountain.preamble


# -- messy txt ----------------------------------------------------------------

@pytest.fixture(scope="module")
def messy():
    return parse_bytes((CORPUS / "messy.txt").read_bytes(), "txt")


def test_messy_scene_segmentation(messy):
    assert [s.slugline for s in messy.scenes] == [
        "EXT. COASTAL HIGHWAY - NIGHT",
        "INT . LIGHTHOUSE - CONTINUOUS",
        "EXT. LIGHTHOUSE - DAWN",
    ]
    assert [s.source_scene_number for s in messy.scenes] == ["1", "2", None]


def test_messy_ocr_slugline_still_parses_fields(messy):
    ocr = messy.scenes[1]
    assert ocr.int_ext == "INT"
    assert ocr.location == "LIGHTHOUSE"
    assert ocr.time_of_day == "CONTINUOUS"


def test_messy_page_furniture_stripped(messy):
    everything = messy.preamble + "\n".join(s.raw_text for s in messy.scenes)
    assert "(CONTINUED)" not in everything
    assert "CONTINUED:" not in everything
    assert "(MORE)" not in everything
    # the bare page number line "2." is gone
    assert not any(line.strip() == "2." for line in everything.splitlines())


def test_messy_dialogue_attribution(messy):
    chars = {c.name: c for c in messy.characters()}
    assert set(chars) == {"MARA", "MRS. O'BRIEN"}
    assert chars["MARA"].dialogue_line_count == 4  # 3 speeches, one wrapped over 2 lines
    assert chars["MARA"].scene_numbers == [1, 2]
    assert chars["MRS. O'BRIEN"].dialogue_line_count == 2  # (O.S.) + (CONT'D) merged
    assert chars["MRS. O'BRIEN"].scene_numbers == [2]


def test_messy_shouty_action_is_not_a_cue(messy):
    scene1 = messy.scenes[0]
    assert any(
        e.type == ElementType.ACTION and e.text.startswith("BANG!") for e in scene1.elements
    )
    assert "BANG! THE ENGINE DIES." not in {c.name for c in messy.characters()}


def test_messy_transitions(messy):
    assert any(
        e.type == ElementType.TRANSITION and e.text == "SMASH CUT TO:"
        for e in messy.scenes[0].elements
    )
    assert any(
        e.type == ElementType.TRANSITION and e.text == "FADE OUT."
        for e in messy.scenes[2].elements
    )


def test_dialogue_heavy_layout_still_finds_the_action_margin():
    """When dialogue lines outnumber action lines (most real screenplays),
    the action margin must be the smallest frequent indent, not the mode —
    regression test for the Big Fish PDF zero-dialogue failure."""
    text = (
        "INT. CAMPFIRE - NIGHT\n"
        "\n"
        "Edward points at the fire.\n"
        "\n"
        "                   EDWARD\n"
        "         I'd tried everything on it:\n"
        "         worms, lures, peanut butter. But\n"
        "         on that day I had a revelation\n"
        "         about what the fish truly desired.\n"
        "\n"
        "                   LITTLE BRAVE\n"
        "              (confused)\n"
        "         Your finger?\n"
        "\n"
        "Edward slips his ring off.\n"
        "\n"
        "                   EDWARD\n"
        "         Gold. The most desired thing there\n"
        "         is, and the hardest to let go.\n"
    )
    parsed = parse_text(text)
    chars = {c.name: c for c in parsed.characters()}
    assert set(chars) == {"EDWARD", "LITTLE BRAVE"}
    assert chars["EDWARD"].dialogue_line_count == 6
    assert chars["LITTLE BRAVE"].dialogue_line_count == 1
    # And the action lines stayed action:
    actions = [e.text for e in parsed.scenes[0].elements if e.type == ElementType.ACTION]
    assert "Edward points at the fire." in actions
    assert "Edward slips his ring off." in actions


def test_shooting_script_letter_prefixed_scene_numbers():
    # A12 / 12B insert numbering is standard in production drafts (audit finding).
    text = (
        "A12 INT. LAB - DAY\n\nA scientist works late.\n\n"
        "12B EXT. ROOF - NIGHT\n\nWind howls over the vents.\n"
    )
    parsed = parse_text(text)
    assert [(s.slugline, s.source_scene_number) for s in parsed.scenes] == [
        ("INT. LAB - DAY", "A12"),
        ("EXT. ROOF - NIGHT", "12B"),
    ]


def test_flat_txt_without_indentation_falls_back_to_blank_line_rules():
    flat = (
        "INT. KITCHEN - DAY\n\nTOM\nWe're out of coffee.\n\n"
        "She stares at him.\n"
    )
    parsed = parse_text(flat)
    assert len(parsed.scenes) == 1
    chars = {c.name for c in parsed.characters()}
    assert chars == {"TOM"}
    assert parsed.scenes[0].dialogue_lines("TOM") == ["We're out of coffee."]


def test_non_screenplay_text_warns():
    parsed = parse_text("Dear diary,\n\nToday I wrote nothing.\n")
    assert parsed.scenes == []
    assert any("no sluglines" in w for w in parsed.warnings)


# -- fdx ----------------------------------------------------------------------

@pytest.fixture(scope="module")
def fdx():
    return parse_bytes((CORPUS / "sample.fdx").read_bytes(), "fdx")


def test_fdx_title_page(fdx):
    assert fdx.title == "The Long Rain"
    assert fdx.authors == ["Jordan Avery"]


def test_fdx_scenes_and_source_numbers(fdx):
    assert [s.slugline for s in fdx.scenes] == ["INT. LIGHTHOUSE - NIGHT", "EXT. DOCK - DAY"]
    assert [s.source_scene_number for s in fdx.scenes] == ["1", "2"]
    assert fdx.scenes[0].time_of_day == "NIGHT"


def test_fdx_dialogue_and_dual(fdx):
    chars = {c.name: c for c in fdx.characters()}
    assert set(chars) == {"MARA", "KEELER"}
    assert chars["MARA"].scene_numbers == [1, 2]
    dock = fdx.scenes[1]
    assert all(e.dual for e in dock.elements if e.type == ElementType.DIALOGUE)


def test_fdx_parenthetical_attribution(fdx):
    lighthouse = fdx.scenes[0]
    parenthetical = next(e for e in lighthouse.elements if e.type == ElementType.PARENTHETICAL)
    assert parenthetical.character == "MARA"


def test_fdx_multiple_text_runs_joined(fdx):
    action = next(e for e in fdx.scenes[0].elements if e.type == ElementType.ACTION)
    assert action.text == "The beam sweeps the water. MARA grips the rail."


def test_fdx_invalid_xml_warns_not_raises():
    parsed = parse_bytes(b"this is not xml at all", "fdx")
    assert parsed.scenes == []
    assert any("not valid FDX" in w for w in parsed.warnings)


# -- pdf ----------------------------------------------------------------------

@pytest.fixture(scope="module")
def pdf():
    return parse_bytes(screenplay_pdf(), "pdf")


def test_pdf_page_count_is_true_count(pdf):
    assert pdf.page_count == 2
    assert pdf.estimated_page_count() == 2


def test_pdf_scene_segmentation(pdf):
    assert [s.slugline for s in pdf.scenes] == [
        "EXT. COASTAL HIGHWAY - NIGHT",
        "INT. LIGHTHOUSE - CONTINUOUS",
    ]


def test_pdf_dialogue_attribution_across_pages(pdf):
    chars = {c.name: c for c in pdf.characters()}
    assert set(chars) == {"MARA", "KEELER"}
    assert chars["MARA"].dialogue_line_count == 3
    assert chars["KEELER"].scene_numbers == [2]


def test_pdf_furniture_stripped(pdf):
    everything = pdf.preamble + "\n".join(s.raw_text for s in pdf.scenes)
    assert "(CONTINUED)" not in everything
    assert "CONTINUED:" not in everything


# -- unit helpers -------------------------------------------------------------

def test_parse_slugline_variants():
    assert parse_slugline("INT. DINER - DAY") == ("INT", "DINER", "DAY")
    assert parse_slugline("EXT KANSAS FARM - MAGIC HOUR") == ("EXT", "KANSAS FARM", "MAGIC HOUR")
    assert parse_slugline("INT./EXT. CAR - MOVING - NIGHT") == ("INT/EXT", "CAR - MOVING", "NIGHT")
    assert parse_slugline("I/E CAR - DAY") == ("INT/EXT", "CAR", "DAY")
    assert parse_slugline("EST. CITY SKYLINE") == ("EXT", "CITY SKYLINE", None)
    assert parse_slugline("INT . LIGHTHOUSE - CONTINUOUS") == ("INT", "LIGHTHOUSE", "CONTINUOUS")


def test_normalize_character_cue_variants():
    assert normalize_character_cue("MARA (V.O.)") == ("MARA", False)
    assert normalize_character_cue("MARA (V.O.) (CONT'D)") == ("MARA", False)
    assert normalize_character_cue("MARA ^") == ("MARA", True)
    assert normalize_character_cue("KEELER:") == ("KEELER", False)


def test_unknown_format_raises():
    with pytest.raises(ValueError):
        parse_bytes(b"", "docx")
