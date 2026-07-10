# Model-selection eval plan

**Decision to make:** which model is the default *reasoning tier* (scoring +
synthesis) per hardware class, and whether the worker tier should change.
Today's defaults were picked by memory-budget arithmetic, not measured quality.

## Candidates

| Model | ~Q4 size | License | Notes |
|---|---|---|---|
| Qwen3.6 27B (dense) | ~24 GB | Apache 2.0 | strongest general open model on consumer hardware (Apr 2026) |
| Gemma 4 E27B/31B | ~20–24 GB | Gemma license | multimodal, tool calling |
| Mistral Small 4 | ~15 GB | Apache 2.0 | 256K context — could shrink digest compaction pressure |
| DeepSeek-R1-Distill-Qwen-32B | ~20 GB | MIT | reasoning traces; emits `<think>` blocks the JSON extractor must tolerate; slower per useful token |
| qwen2.5:32b / qwen3:30b | ~20 GB | Apache 2.0 | current DECISIONS defaults — the baselines to beat |
| gpt-oss:20b | ~13 GB | Apache 2.0 | "best small" class — candidate for 16–24 GB machines |
| llama3.1:8b | ~5 GB | Llama license | current minimum tier + worker — floor baseline |

**Hardware reality:** the dev machine (16 GB Apple Silicon, 8 GB model budget)
can run only the 8B class locally. Evaluating the 20–32B candidates requires
either (a) a rented GPU box running Ollama (public/test scripts only — no
private material; ~$1–2/hr, a full sweep ≈ $15–40) or (b) a ≥32 GB machine.
**Renting costs money → operator sign-off before Phase B.**

## Corpus (the key design: ground truth by construction)

1. **Real scripts (4–6):** Big Fish in Fountain *and* PDF (format robustness),
   plus 3–4 more freely-distributed Fountain features (John August's library)
   spanning genres. Never committed to the repo; fetched by a script.
2. **Engineered-defect pairs (8–10):** take one clean script and produce
   surgically damaged variants — dialogue made on-the-nose (subtext stripped),
   act two scrambled (structure), protagonist decisions handed to side
   characters (agency), profanity/violence injected (rating), a cast bloated
   with redundant speakers (production). Each pair has a *known* answer:
   the damaged variant must score ≤ the clean one on the target dimension.
   This measures discrimination without pretending we own absolute taste.
3. **Thin-signal traps (3–4):** short/sparse scripts engineered so specific
   dimensions genuinely lack evidence — the honest answer is
   `insufficient_evidence`, and claiming a score is a failure.

## Metrics (mechanical first — the verification layer is the judge)

| Metric | Source | What it selects for |
|---|---|---|
| Citation integrity: kept / (dropped+relocated) | VerificationStats, already instrumented | grounding, anti-fabrication |
| Schema retry + failure rate | llmjson (add a counter) | reliability of structured output |
| Reproducibility: score flips across 3 runs | rubric diff, same input | stability writers can trust |
| Defect discrimination: damaged ≤ clean on target dimension | engineered pairs | actual judgment, pairwise |
| Honesty on thin signal: withholds vs confabulates | trap scripts | the "insufficient evidence" promise |
| Synthesis grounding: named characters/events exist in digest | mechanical scan | logline/synopsis faithfulness |
| Wall time + peak memory per full run | harness timing | practicality per tier |
| **Human layer:** blind A/B of 3 full reports (operator picks the better read, per section) | Parth | taste — the part arithmetic can't score |

## Harness

`backend/evals/` — a runner that points the existing pipeline at any Ollama
endpoint (`OLLAMA_URL` + `SCREENSCORE_ALLOW_REMOTE_RUNTIME=1` for a rented
box), sweeps (model × corpus × 3 seeds), and emits one `results.json` +
a comparison table. Per-model stage caches already isolate runs; engineered
variants are generated deterministically by a corpus script so the whole eval
is reproducible from the repo.

## Decision rubric

Disqualify any model that fabricates on thin-signal traps or fails schema
reliability (>5% unrecoverable). Then rank by defect discrimination and
citation integrity (equal weight), tie-break on reproducibility, then speed.
The worker tier only changes if a candidate's map pass beats llama3.1:8b on
verbatim notable-line rate at comparable speed.

## Phasing

- **Phase A (local, free):** build corpus generator + harness; validate
  end-to-end with llama3.1:8b and the fake runtime; baseline numbers.
- **Phase B (needs sign-off):** candidate sweep on rented GPU or larger Mac.
- **Phase C:** update hardware.py tier ladder + DECISIONS with measured picks;
  keep the harness as the standing gate for future prompt/model changes.
