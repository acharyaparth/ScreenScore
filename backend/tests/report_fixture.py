"""A hand-built, schema-valid report for contract tests — independent of the
pipeline so schema tests keep working no matter how generation evolves."""


def make_report(**overrides) -> dict:
    report = {
        "schema_version": "1.0",
        "meta": {
            "report_id": "r1", "draft_id": "d1", "script_hash": "abc123",
            "generated_at": "2026-07-06T00:00:00+00:00", "engine_version": "test",
            "prompt_version": "1.0", "models": {"worker": "w", "reasoning": "r"},
            "stub": True,
        },
        "header": {
            "title": "Test Script", "writers": ["A. Writer"], "page_count": 100,
            "estimated_runtime_minutes": 100, "scene_count": 40,
            "genres": [{"name": "Drama", "confidence": 0.8}],
            "source_format": "fountain", "draft_label": None,
        },
        "logline": "A test logline.",
        "synopsis": {"overview": None, "acts": [{"act": "Act One", "summary": "Things happen."}]},
        "rubric": [
            {
                "id": dim_id, "name": dim_id.title(), "score": "fair",
                "insufficient_evidence": False, "rationale": "Because reasons.",
                "evidence": [{"scene_number": 3, "quote": "A quoted line.", "note": None}],
            }
            for dim_id in [
                "premise_originality", "structure_pacing", "characterization", "dialogue",
                "theme_resonance", "marketability", "production_complexity", "representation_content",
            ]
        ],
        "characters": {
            "principals": [{"name": "MARA", "description": "Lead.", "dialogue_share": 0.5,
                            "scene_numbers": [1, 2], "arc_summary": "Changes."}],
            "graph": {"edges": [{"a": "MARA", "b": "KEELER", "shared_scenes": 2}]},
        },
        "comps": {"disclaimer": "Model-suggested, not verified.", "items": [
            {"title": "Comp Film", "year": 2020, "medium": "film", "reason": "Similar."}]},
        "budget_tier": {"tier": "mid", "drivers": ["locations"]},
        "content_rating": {"estimated": "PG-13", "drivers": [
            {"category": "language", "detail": "Some.", "evidence": []}]},
        "scene_notes": [{"scene_number": 3, "kind": "standout", "note": "Nice.",
                         "evidence": [{"scene_number": 3, "quote": "A quoted line.", "note": None}]}],
        "recommendation": {"verdict": "consider", "rationale": "On balance."},
    }
    report.update(overrides)
    return report
