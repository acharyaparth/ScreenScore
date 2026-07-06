"""Evidence verification is the traceability enforcement — test it hard."""

from screenscore.pipeline.verify import EvidenceVerifier, VerificationStats, consistent_verdict

PARSED = {
    "scenes": [
        {"number": 1, "raw_text": 'INT. KITCHEN - DAY\n\nTOM\nWe\'re out of everything that matters.'},
        {"number": 2, "raw_text": "EXT. STREET - NIGHT\n\nTom walks past shuttered storefronts."},
    ]
}


def make_dim(evidence, score="good"):
    return {
        "id": "dialogue", "name": "Dialogue", "score": score,
        "insufficient_evidence": False, "rationale": "Fine work.", "evidence": evidence,
    }


def test_exact_citation_kept():
    verifier = EvidenceVerifier(PARSED)
    kept = verifier.check({"scene_number": 1, "quote": "We're out of everything that matters."})
    assert kept is not None and kept["scene_number"] == 1
    assert verifier.stats.kept == 1


def test_citation_normalization_is_forgiving():
    verifier = EvidenceVerifier(PARSED)
    # curly apostrophe, different case, extra whitespace
    kept = verifier.check({"scene_number": 1, "quote": "we’re out of  EVERYTHING that matters."})
    assert kept is not None


def test_wrong_scene_number_is_relocated():
    verifier = EvidenceVerifier(PARSED)
    fixed = verifier.check({"scene_number": 2, "quote": "We're out of everything that matters."})
    assert fixed["scene_number"] == 1
    assert "corrected" in fixed["note"]
    assert verifier.stats.relocated == 1


def test_fabricated_quote_is_dropped():
    verifier = EvidenceVerifier(PARSED)
    assert verifier.check({"scene_number": 1, "quote": "This line was never written."}) is None
    assert verifier.stats.dropped == 1


def test_tiny_quotes_are_dropped():
    verifier = EvidenceVerifier(PARSED)
    assert verifier.check({"scene_number": 1, "quote": "TOM"}) is None


def test_scored_dimension_with_only_fabricated_evidence_is_downgraded():
    verifier = EvidenceVerifier(PARSED)
    rubric = verifier.verify_rubric([make_dim([{"scene_number": 1, "quote": "Entirely invented line."}])])
    dim = rubric[0]
    assert dim["insufficient_evidence"] is True
    assert dim["score"] is None
    assert "withheld" in dim["rationale"]
    assert verifier.stats.dimensions_downgraded == ["dialogue"]


def test_scene_note_for_missing_scene_is_dropped():
    verifier = EvidenceVerifier(PARSED)
    notes = verifier.verify_scene_notes([
        {"scene_number": 99, "kind": "standout", "note": "n", "evidence": []},
        {"scene_number": 2, "kind": "problem", "note": "n", "evidence": []},
    ])
    assert [n["scene_number"] for n in notes] == [2]


# -- verdict consistency guard --------------------------------------------

def scored(*scores):
    return [{"id": f"d{i}", "score": s} for i, s in enumerate(scores)]


def test_recommend_with_many_weak_dims_pulled_back():
    stats = VerificationStats()
    verdict = consistent_verdict("recommend", scored("weak", "weak", "weak", "good", "fair", "fair"), stats)
    assert verdict == "consider"
    assert stats.verdict_adjusted


def test_pass_with_mostly_good_scores_pulled_back():
    stats = VerificationStats()
    verdict = consistent_verdict("pass", scored("good", "good", "excellent", "good", "fair"), stats)
    assert verdict == "consider"


def test_consistent_verdicts_untouched():
    stats = VerificationStats()
    assert consistent_verdict("pass", scored("weak", "weak", "fair"), stats) == "pass"
    assert consistent_verdict("recommend", scored("good", "excellent", "good", "good"), stats) == "recommend"
    assert stats.verdict_adjusted is None


def test_no_verifiable_scores_cannot_recommend():
    stats = VerificationStats()
    assert consistent_verdict("recommend", [{"id": "d", "score": None}], stats) == "consider"
