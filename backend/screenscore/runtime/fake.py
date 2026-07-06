"""A deterministic fake model runtime.

Used for tests and for UI development without Ollama (SCREENSCORE_FAKE_LLM=1).
It answers each pipeline prompt with plausible, well-formed JSON and —
important for honesty — quotes real lines from the material it is shown, so
evidence verification behaves the same as with a real model. Reports produced
through it are marked meta.stub=true and bannered in the UI.
"""

import json
import re
from typing import AsyncIterator

from .base import ModelRuntime, RuntimeInfo

DIGEST_SCENE_RE = re.compile(r"^SC (\d+) \|", re.MULTILINE)
DIGEST_QUOTE_RE = re.compile(r'^\s*» ([^:]+): "(.+)"\s*$', re.MULTILINE)


class FakeRuntime(ModelRuntime):
    def __init__(self) -> None:
        self.generate_calls = 0
        self.history: list[str] = []  # prompt kinds, for cache/resume tests

    async def info(self) -> RuntimeInfo:
        return RuntimeInfo(available=True, backend="fake", url=None, version="0",
                           detail="Built-in fake model (development mode) — reports are placeholders.")

    async def list_models(self) -> list[str]:
        return ["fake"]

    async def pull(self, model: str) -> AsyncIterator[dict]:
        yield {"status": "success"}

    def _kind(self, prompt: str) -> str:
        if "Summarize ONE scene" in prompt:
            return "map"
        if "character breakdowns" in prompt and '"arc_summary"' in prompt:
            return "characters"
        if "Score exactly ONE dimension" in prompt:
            return "specialist"
        if "selecting scene-level notes" in prompt:
            return "notes"
        if "narrative sections" in prompt:
            return "narrative"
        if "commercial assessment" in prompt:
            return "commercial"
        if "comparing two drafts" in prompt:
            return "diff"
        return "unknown"

    async def generate(self, model, prompt, *, system=None, json_format=False, options=None) -> str:
        self.generate_calls += 1
        kind = self._kind(prompt)
        self.history.append(kind)
        if kind == "map":
            return self._map(prompt)
        if kind == "characters":
            return self._characters(prompt)
        if kind == "specialist":
            return self._specialist(prompt)
        if kind == "notes":
            return self._notes(prompt)
        if kind == "narrative":
            return json.dumps({
                "logline": "A determined protagonist confronts an escalating obstacle with real stakes.",
                "synopsis": {
                    "overview": "A fake-model synopsis for development purposes.",
                    "acts": [
                        {"act": "Act One", "summary": "Setup, rendered by the fake model."},
                        {"act": "Act Two", "summary": "Confrontation, rendered by the fake model."},
                        {"act": "Act Three", "summary": "Resolution, rendered by the fake model."},
                    ],
                },
            })
        if kind == "diff":
            return json.dumps({
                "overall": "A mixed revision: some tightening, one real step backward (fake-model narrative).",
                "dimension_comments": [{"id": "dialogue", "comment": "Exchanges are leaner in the new draft (fake model)."}],
                "improved": ["The opening now establishes the protagonist's want faster."],
                "persisted": ["The midpoint still arrives without a reversal."],
                "new_issues": ["A new subplot in the second half goes nowhere."],
                "regressions": ["The earlier draft's ending had more consequence; the new one softens it."],
            })
        if kind == "commercial":
            return json.dumps({
                "genres": [{"name": "Drama", "confidence": 0.7}],
                "comps": [{"title": "A Comparable Film", "year": 2019, "medium": "film",
                           "reason": "similar contained-thriller shape"}],
                "budget_tier": {"tier": "low", "drivers": ["few locations", "small cast"]},
                "content_rating": {"estimated": "PG-13",
                                   "drivers": [{"category": "thematic", "detail": "tense peril throughout"}]},
                "recommendation": {"verdict": "consider",
                                   "rationale": "Fake-model verdict, consistent with mostly-good rubric scores."},
            })
        return json.dumps({})

    # -- per-prompt fakes -------------------------------------------------

    def _map(self, prompt: str) -> str:
        scene_match = re.search(r"Scene (\d+) — slugline: (.*)", prompt)
        body = prompt.split("---")[1] if "---" in prompt else ""
        # Quote a real line verbatim so evidence verification passes.
        candidates = [l.strip() for l in body.splitlines()
                      if 8 <= len(l.strip()) <= 90 and not l.strip().isupper()]
        notable = (
            [{"speaker": "ACTION", "line": max(candidates, key=len)}] if candidates else []
        )
        slug = scene_match.group(2).strip() if scene_match else "the scene"
        return json.dumps({
            "summary": f"Events unfold at {slug.lower()} (fake-model summary).",
            "tone": ["tense"],
            "notable_lines": notable,
        })

    def _characters(self, prompt: str) -> str:
        names = re.findall(r"^([A-Z][A-Z .'\-]+): \d+ lines", prompt, re.MULTILINE)
        return json.dumps({"characters": [
            {"name": name.strip(), "description": f"{name.title()} as rendered by the fake model.",
             "arc_summary": "Starts one way, ends another (fake model)."}
            for name in dict.fromkeys(names)
        ]})

    def _digest_quotes(self, prompt: str) -> list[tuple[int, str]]:
        """(scene_number, quote) pairs from the digest's » lines."""
        quotes: list[tuple[int, str]] = []
        current_scene = None
        for line in prompt.splitlines():
            scene = DIGEST_SCENE_RE.match(line)
            if scene:
                current_scene = int(scene.group(1))
                continue
            quote = DIGEST_QUOTE_RE.match(line)
            if quote and current_scene is not None:
                quotes.append((current_scene, quote.group(2)))
        return quotes

    def _specialist(self, prompt: str) -> str:
        quotes = self._digest_quotes(prompt)
        evidence = [{"scene_number": n, "quote": q} for n, q in quotes[:2]]
        if not evidence:
            return json.dumps({"score": None, "insufficient_evidence": True,
                               "rationale": "No quotable material reached the fake model.",
                               "evidence": []})
        return json.dumps({"score": "good", "insufficient_evidence": False,
                           "rationale": "A solid showing on this dimension (fake-model rationale for development).",
                           "evidence": evidence})

    def _notes(self, prompt: str) -> str:
        quotes = self._digest_quotes(prompt)
        notes = []
        if quotes:
            first_scene, first_quote = quotes[0]
            notes.append({"scene_number": first_scene, "kind": "standout",
                          "note": "A beat that lands (fake model).", "quote": first_quote})
            last_scene, last_quote = quotes[-1]
            if last_scene != first_scene:
                notes.append({"scene_number": last_scene, "kind": "problem",
                              "note": "A beat that needs work (fake model).", "quote": last_quote})
        return json.dumps({"notes": notes})
