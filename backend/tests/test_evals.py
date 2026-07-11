"""Eval harness: defect transforms and metric scoring."""

from evals import corpus, metrics

CLEAN = """Title: Test

INT. KITCHEN - DAY

TOM stirs coffee.

TOM
We're out of everything that matters.

EXT. STREET - NIGHT

Tom walks in the rain, collar up against it.

TOM
Every light went out years ago.

INT. DINER - NIGHT

MAE slides a plate over.

MAE
Took you long enough, mister.

TOM
That obvious?

INT. BACK ROOM - NIGHT

They count the night's take in silence.

MAE
Same again tomorrow?

TOM
Same again tomorrow.
"""


def test_split_and_join_roundtrip():
    preamble, blocks = corpus.split_scenes(CLEAN)
    assert len(blocks) == 4
    assert corpus.join_scenes(preamble, blocks).strip() == CLEAN.strip()


def test_scramble_keeps_all_scenes():
    name, dim, out = corpus.scramble_structure(CLEAN)
    assert dim == "structure_pacing"
    _, blocks = corpus.split_scenes(out)
    assert len(blocks) == 4
    assert "MAE" in out and "TOM" in out


def test_agency_removal_reassigns_lead_cues():
    name, dim, out = corpus.remove_protagonist_agency(CLEAN)
    assert dim == "characterization"
    assert "A BYSTANDER" in out
    assert out.count("A BYSTANDER") >= 2


def test_flatten_appends_literal_statement_to_speeches():
    name, dim, out = corpus.flatten_dialogue(CLEAN)
    assert dim == "dialogue"
    assert out.count("exactly what I feel") >= 3


def test_content_injection_adds_violence_and_profanity():
    name, dim, out = corpus.inject_content(CLEAN)
    assert dim == "content_rating"
    assert "fucking" in out and "Blood" in out


def test_duplicate_middle_repeats_scenes():
    name, dim, out = corpus.duplicate_middle(CLEAN)
    _, blocks = corpus.split_scenes(out)
    assert len(blocks) > 4


def test_transforms_are_deterministic():
    a = corpus.scramble_structure(CLEAN)[2]
    b = corpus.scramble_structure(CLEAN)[2]
    assert a == b


# ---------------------------------- metrics ----------------------------------

def _report(rubric_scores: dict, rating="PG-13", budget="studio", logline="", comps=()):
    return {
        "logline": logline,
        "rubric": [
            {"id": k, "score": v, "insufficient_evidence": v is None}
            for k, v in rubric_scores.items()
        ],
        "content_rating": {"estimated": rating},
        "budget_tier": {"tier": budget},
        "comps": {"items": [{"title": c} for c in comps]},
    }


def test_spine_score():
    groups = [["father", "dad"], ["son"], ["stories", "tales"]]
    assert metrics.spine_score("A father and son bond over tall tales.", groups) == 1.0
    assert metrics.spine_score("A man goes on an adventure.", groups) == 0.0


def test_ladder_scores():
    assert metrics.rating_score(_report({}, rating="PG-13"), {"rating": "PG-13"}) == 1.0
    assert metrics.rating_score(_report({}, rating="R"), {"rating": "PG-13"}) == 0.5
    assert metrics.rating_score(_report({}, rating="G"), {"rating": "PG-13"}) == 0.0
    assert metrics.budget_score(_report({}, budget="mid"), {"budget_tier": "studio"}) == 0.5


def test_defect_pair_scoring():
    clean = _report({"dialogue": "good"})
    worse = _report({"dialogue": "weak"})
    same = _report({"dialogue": "good"})
    better = _report({"dialogue": "excellent"})
    assert metrics.defect_pair_score(clean, worse, "dialogue") == 1.0
    assert metrics.defect_pair_score(clean, same, "dialogue") == 0.5
    assert metrics.defect_pair_score(clean, better, "dialogue") == 0.0


def test_defect_pair_scoring_content_rating():
    clean = _report({}, rating="PG-13")
    raised = _report({}, rating="R")
    assert metrics.defect_pair_score(clean, raised, "content_rating") == 1.0
    assert metrics.defect_pair_score(clean, clean, "content_rating") == 0.5


def test_trap_score_rewards_withholding():
    withheld = _report({"dialogue": None})
    scored = _report({"dialogue": "fair"})
    assert metrics.trap_score(withheld, "dialogue") == 1.0
    assert metrics.trap_score(scored, "dialogue") == 0.0


def test_verify_stats_parsing():
    events = [{"type": "stage", "stage": "verify", "status": "completed",
               "detail": "27 citations checked: 20 verified, 2 relocated to the correct scene, 5 dropped"}]
    stats = metrics.verify_stats_from_events(events)
    assert stats["checked"] == 27 and stats["dropped"] == 5
    assert abs(stats["integrity"] - 20 / 27) < 1e-6


def test_flip_rate():
    a = _report({"dialogue": "good", "structure_pacing": "fair"})
    b = _report({"dialogue": "weak", "structure_pacing": "fair"})
    assert metrics.score_flip_rate([a, b]) == 0.5
    assert metrics.score_flip_rate([a, a]) == 0.0
