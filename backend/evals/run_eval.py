"""Eval runner: sweep one (worker, reasoning) model pair over the corpus.

Runs the REAL pipeline in-process against any Ollama endpoint (an SSH-tunneled
vast.ai box appears as localhost — preferred: no exposed model port). Seeds
vary generation options, which are part of cache identity, so re-runs are
cheap and seeds never collide.

Usage:
  uv run python -m evals.run_eval --corpus evals_data/corpus --out evals_data/results \
      --worker llama3.1:8b --reasoning qwen3.6:27b --seeds 2
  # smoke test without any model:
  uv run python -m evals.run_eval ... --fake --seeds 1

Sweep multiple pairs with a shell loop; each invocation appends one results
file per pair.
"""

import argparse
import asyncio
import json
import os
import statistics
import time
from pathlib import Path

from . import metrics


async def _wait_report(client, report_id: str, timeout: float) -> tuple[dict, list[dict]]:
    """Follow the SSE stream to completion; return (report_row, events)."""
    events: list[dict] = []

    async def consume():
        async with client.stream("GET", f"/api/reports/{report_id}/events") as stream:
            async for line in stream.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)
                    if event["type"] in ("done", "failed"):
                        return

    await asyncio.wait_for(consume(), timeout)
    row = (await client.get(f"/api/reports/{report_id}")).json()
    return row, events


async def run_sweep(args) -> Path:
    os.environ["SCREENSCORE_DATA_DIR"] = str(Path(args.out) / "data")
    if args.fake:
        os.environ["SCREENSCORE_FAKE_LLM"] = "1"
    elif args.endpoint:
        os.environ["OLLAMA_URL"] = args.endpoint

    import httpx

    from screenscore.main import create_app
    from screenscore.pipeline import stages

    app = create_app()
    transport = httpx.ASGITransport(app=app)
    manifest = json.loads((Path(args.corpus) / "manifest.json").read_text())

    pair_tag = f"{args.worker}+{args.reasoning}".replace("/", "_").replace(":", "-")
    rows: list[dict] = []
    reports_by_item_seed: dict[tuple[str, int], dict] = {}

    async with httpx.AsyncClient(transport=transport, base_url="http://eval", timeout=60) as client:
        for seed in range(args.seeds):
            # Seed participates in generation options → cache identity.
            stages.WORKER_OPTS["seed"] = seed
            stages.REASONING_OPTS["seed"] = seed
            for item in manifest["items"]:
                path = Path(args.corpus) / item["file"]
                started = time.time()
                resp = await client.post(
                    "/api/analyze",
                    data={"worker_model": args.worker, "reasoning_model": args.reasoning},
                    files={"file": (item["file"], path.read_bytes(), "text/plain")},
                )
                if resp.status_code != 200:
                    rows.append({"item": item["id"], "seed": seed, "status": "upload_failed",
                                 "error": resp.text[:300]})
                    continue
                report_id = resp.json()["report_id"]
                try:
                    row, events = await _wait_report(client, report_id, args.timeout)
                except asyncio.TimeoutError:
                    rows.append({"item": item["id"], "seed": seed, "status": "timeout"})
                    continue
                record = {
                    "item": item["id"], "kind": item["kind"], "seed": seed,
                    "status": row["status"], "wall_seconds": round(time.time() - started, 1),
                    "verify": metrics.verify_stats_from_events(events),
                }
                if row["status"] == "complete":
                    report = row["report"]
                    reports_by_item_seed[(item["id"], seed)] = report
                    truth = item.get("ground_truth") or {}
                    if item["kind"] == "real" and truth:
                        record["spine"] = metrics.spine_score(report["logline"], truth.get("spine_groups", []))
                        record["rating"] = metrics.rating_score(report, truth)
                        record["budget"] = metrics.budget_score(report, truth)
                        record["comps"] = metrics.comps_score(report, truth)
                    if item["kind"] == "trap":
                        record["trap"] = metrics.trap_score(report, item["target_dimension"])
                else:
                    record["error"] = (row.get("error") or "")[:300]
                rows.append(record)
                print(f"[{pair_tag} seed {seed}] {item['id']}: {row['status']} "
                      f"({record['wall_seconds']}s)", flush=True)

        # Defect pairs: compare against the clean report of the SAME seed.
        for item in manifest["items"]:
            if item["kind"] != "defect_variant":
                continue
            for seed in range(args.seeds):
                clean = reports_by_item_seed.get((item["clean_id"], seed))
                damaged = reports_by_item_seed.get((item["id"], seed))
                if clean and damaged:
                    rows.append({
                        "item": item["id"], "seed": seed, "kind": "pair_check",
                        "target": item["target_dimension"],
                        "pair": metrics.defect_pair_score(clean, damaged, item["target_dimension"]),
                    })

        # Reproducibility: flip rate across seeds per item.
        if args.seeds > 1:
            for item in manifest["items"]:
                reports = [reports_by_item_seed[(item["id"], s)]
                           for s in range(args.seeds) if (item["id"], s) in reports_by_item_seed]
                flip = metrics.score_flip_rate(reports)
                if flip is not None:
                    rows.append({"item": item["id"], "kind": "flip_rate", "flip": flip})

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    result = {
        "worker": args.worker, "reasoning": args.reasoning, "seeds": args.seeds,
        "endpoint": args.endpoint or ("fake" if args.fake else "auto"),
        "rows": rows, "summary": summarize(rows),
    }
    out_file = out_dir / f"{pair_tag}.json"
    out_file.write_text(json.dumps(result, indent=2))
    print(json.dumps(result["summary"], indent=2))
    print(f"written: {out_file}")
    return out_file


def _mean(values):
    values = [v for v in values if isinstance(v, (int, float)) and v == v]
    return round(statistics.mean(values), 3) if values else None


def summarize(rows: list[dict]) -> dict:
    complete = [r for r in rows if r.get("status") == "complete"]
    return {
        "runs": len([r for r in rows if "status" in r]),
        "completed": len(complete),
        "failures": len([r for r in rows if r.get("status") not in (None, "complete")]),
        "spine": _mean([r.get("spine") for r in rows]),
        "rating": _mean([r.get("rating") for r in rows]),
        "budget": _mean([r.get("budget") for r in rows]),
        "comps": _mean([r.get("comps") for r in rows]),
        "defect_pairs": _mean([r.get("pair") for r in rows if r.get("kind") == "pair_check"]),
        "traps": _mean([r.get("trap") for r in rows]),
        "citation_integrity": _mean([(r.get("verify") or {}).get("integrity") for r in rows]),
        "flip_rate": _mean([r.get("flip") for r in rows if r.get("kind") == "flip_rate"]),
        "median_wall_seconds": (
            round(statistics.median([r["wall_seconds"] for r in complete]), 1) if complete else None
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--worker", default="llama3.1:8b")
    parser.add_argument("--reasoning", default="llama3.1:8b")
    parser.add_argument("--seeds", type=int, default=1)
    parser.add_argument("--endpoint", default=None, help="Ollama URL (default: auto-discover)")
    parser.add_argument("--timeout", type=float, default=7200, help="per-script seconds")
    parser.add_argument("--fake", action="store_true", help="use the built-in fake model (harness smoke test)")
    args = parser.parse_args()
    asyncio.run(run_sweep(args))


if __name__ == "__main__":
    main()
