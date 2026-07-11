# Running the model evals

Phase A (harness, corpus, metrics) is built and smoke-tested. Phase B is a
sweep of candidate models on rented GPU hardware.

## 1. Build the corpus (once, locally)

```bash
cd backend
uv run python -m evals.corpus --dir ../evals_data/corpus
# offline: --source bigfish=/path/to/bigfish.fountain
```

Produces: real script(s) + 5 engineered-defect variants each + 2 thin-signal
traps + manifest with produced-film ground truth. Nothing here is committed.

## 2. Rent the box (vast.ai) and tunnel

Pick a machine with ≥24 GB VRAM (A5000/3090/4090 class is enough; the models
are Q4). On the box:

```bash
docker run -d --gpus all -v ollama:/root/.ollama -p 127.0.0.1:11434:11434 ollama/ollama
docker exec -it <ctr> ollama pull qwen3.6:27b        # per candidate list
```

From this Mac, tunnel instead of exposing the port (model port never faces
the internet, and locally it just looks like localhost):

```bash
ssh -N -L 11434:localhost:11434 root@<vast-host> -p <vast-port>
```

Only public/test scripts go to this box — never private material.

## 3. Sweep

One invocation per (worker, reasoning) pair; results accumulate in `--out`:

```bash
for R in qwen3.6:27b gemma4:27b mistral-small4 deepseek-r1-distill-qwen:32b qwen2.5:32b; do
  uv run python -m evals.run_eval \
    --corpus ../evals_data/corpus --out ../evals_data/results \
    --worker llama3.1:8b --reasoning "$R" --seeds 3
done
# ensemble probes: also try the strong model as its own worker, e.g.
#   --worker qwen3.6:27b --reasoning qwen3.6:27b
# harness smoke test without any model:
#   ... --fake --seeds 1
```

Timing: a 192-scene script is ~200 model calls; budget roughly 1–2 h per
(pair × corpus × 3 seeds) on a single GPU — start with `--seeds 1` to triage,
3 seeds for finalists. Stage caches make interrupted sweeps resumable.

## 4. Read the results

Each `results/<pair>.json` carries per-run rows and a summary:

- **Null baseline (fake model):** defect_pairs 0.50, traps 0.0, spine 0.33.
  A candidate below/at these numbers is not analyzing.
- Rank finalists on: spine / rating / budget / comps (produced-film ground
  truth), defect_pairs, traps. Gates: failures, citation_integrity,
  flip_rate, median_wall_seconds.
- Finalists then go to the human layer: full Big Fish reports, blind A/B
  (docs/EVAL-PLAN.md).
