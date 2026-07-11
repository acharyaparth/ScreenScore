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

## What we measure — coverage quality first

The eval's subject is the **analysis itself**, not the plumbing. Reliability
metrics still exist, but as pass/fail gates, not the headline.

### A. Judgment quality (primary — ranks the candidates)

| Metric | Ground truth | How scored |
|---|---|---|
| Logline fidelity | Produced films have known loglines/spines (Big Fish: a son trying to know his dying father behind the tall tales) | judged: does the model's logline name the actual protagonist, want, and engine — or a generic paraphrase? |
| Synopsis factual accuracy | The film/script's actual events | count of invented or misattributed events per act |
| Content rating & budget tier | Actual MPAA rating and production budget of produced films | exact/adjacent-tier match |
| Comps plausibility | Critical consensus for well-known films | judged: in-genre, in-tone, defensible |
| Defect discrimination | Engineered pairs (below) — the damaged variant is *known* worse on one dimension | damaged ≤ clean on the target dimension, pairwise |
| Thin-signal honesty | Trap scripts built to lack signal on specific dimensions | withholds (`insufficient_evidence`) vs confabulates |
| Rationale quality | Frontier-model judge (public scripts ONLY — never user material; small paid API cost, needs sign-off) | rubric: specificity to this script, consistency with the digest, insight beyond plot summary |
| Full-report read | Operator blind A/B, 3 scripts | which report would you hand a producer? per-section notes |

**Produced-film ground truth is the workhorse:** scripts of released films give
free, objective answers for exactly the synthesis judgments where the 8B
visibly failed (the Big Fish logline missed the story's spine entirely).

### B. Reliability gates (pass/fail, not ranked)

Citation integrity (verifier stats), schema retry/failure rate (<5%),
score-flip rate across 3 seeds, wall time and peak memory per tier. A model
failing a gate is out regardless of judgment scores.

## Harness

`backend/evals/` — a runner that points the existing pipeline at any Ollama
endpoint (`OLLAMA_URL` + `SCREENSCORE_ALLOW_REMOTE_RUNTIME=1` for a rented
box), sweeps (model × corpus × 3 seeds), and emits one `results.json` +
a comparison table. Per-model stage caches already isolate runs; engineered
variants are generated deterministically by a corpus script so the whole eval
is reproducible from the repo.

## Decision rubric

Disqualify on any reliability gate or thin-signal fabrication. Then rank on
judgment quality: produced-film ground-truth accuracy and defect
discrimination carry the most weight, rationale-quality judge scores next,
operator A/B breaks ties. Speed only separates otherwise-equal candidates.
The worker tier only changes if a candidate's map pass beats llama3.1:8b on
verbatim notable-line rate at comparable speed.

## Phasing

- **Phase A (local, free):** build corpus generator + harness; validate
  end-to-end with llama3.1:8b and the fake runtime; baseline numbers.
- **Phase B (needs sign-off):** candidate sweep on rented GPU or larger Mac.
- **Phase C:** update hardware.py tier ladder + DECISIONS with measured picks;
  keep the harness as the standing gate for future prompt/model changes.
