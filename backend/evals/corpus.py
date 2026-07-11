"""Eval corpus: real scripts + engineered-defect variants + thin-signal traps.

The defect transforms are deterministic text-level operations on Fountain
sources. Each produces a variant that is *worse by construction* on exactly
one rubric dimension — ground truth without pretending we own absolute taste.
"""

import json
import random
import re
import urllib.request
from pathlib import Path

SLUG_LINE = re.compile(r"^(INT|EXT|EST|I/E)[.\s]", re.IGNORECASE)
CUE_LINE = re.compile(r"^[A-Z][A-Z0-9 .'\-]*(\s*\(.*\))?\s*$")

# Real, freely-distributed scripts of PRODUCED films — produced-film ground
# truth (rating, budget, spine) is the eval's workhorse. Never committed.
FETCH_REGISTRY = {
    "bigfish": "https://fountain.io/_downloads/Big%20Fish.fountain",
    # add more freely-distributed .fountain URLs as they are confirmed
}

GROUND_TRUTH = {
    "bigfish": {
        "title": "Big Fish",
        "rating": "PG-13",
        "budget_tier": "studio",
        # every group must be represented in a faithful logline (any term of the group)
        "spine_groups": [
            ["father", "dad", "edward"],
            ["son", "will"],
            ["stories", "tales", "tall tale", "myth", "fabulis", "legend"],
        ],
        "acceptable_comps": [
            "forrest gump", "the curious case of benjamin button", "secondhand lions",
            "life of pi", "edward scissorhands", "charlie and the chocolate factory",
            "the princess bride", "o brother, where art thou", "finding neverland",
        ],
    },
}


# ------------------------------ scene splitting -------------------------------

def split_scenes(text: str) -> tuple[str, list[str]]:
    """(preamble, [scene blocks]) at slugline boundaries."""
    lines = text.split("\n")
    boundaries = [
        i for i, line in enumerate(lines)
        if SLUG_LINE.match(line.strip()) and (i == 0 or not lines[i - 1].strip())
    ]
    if not boundaries:
        return text, []
    preamble = "\n".join(lines[: boundaries[0]])
    blocks = [
        "\n".join(lines[start:end])
        for start, end in zip(boundaries, boundaries[1:] + [len(lines)])
    ]
    return preamble, blocks


def join_scenes(preamble: str, blocks: list[str]) -> str:
    return preamble + "\n" + "\n".join(blocks)


def _most_frequent_cues(text: str, top: int = 2) -> list[str]:
    counts: dict[str, int] = {}
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped and stripped == stripped.upper() and CUE_LINE.match(stripped) \
                and not SLUG_LINE.match(stripped) and len(stripped) <= 40:
            name = re.sub(r"\s*\(.*\)\s*$", "", stripped).rstrip("^").strip()
            if name and not SLUG_LINE.match(name):
                counts[name] = counts.get(name, 0) + 1
    return [n for n, _ in sorted(counts.items(), key=lambda kv: -kv[1])[:top]]


# ------------------------------ defect transforms ------------------------------
# Each returns (variant_name, target_dimension, transformed_text).

def scramble_structure(text: str, seed: int = 7) -> tuple[str, str, str]:
    """Shuffle the middle half of scenes: act structure destroyed, everything
    else intact. Structure & pacing must not score better than the clean draft."""
    preamble, blocks = split_scenes(text)
    n = len(blocks)
    lo, hi = n // 4, (3 * n) // 4
    middle = blocks[lo:hi]
    random.Random(seed).shuffle(middle)
    return "scrambled_structure", "structure_pacing", join_scenes(preamble, blocks[:lo] + middle + blocks[hi:])


def remove_protagonist_agency(text: str) -> tuple[str, str, str]:
    """Reassign most of the lead's dialogue to a new minor character: the
    protagonist stops driving scenes. Characterization must suffer."""
    lead = _most_frequent_cues(text, 1)[0]
    out, count = [], 0
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith(lead) and CUE_LINE.match(stripped):
            count += 1
            if count % 3 != 0:  # keep every third line with the lead
                line = line.replace(lead, "A BYSTANDER", 1)
        out.append(line)
    return "agency_removed", "characterization", "\n".join(out)


def flatten_dialogue(text: str) -> tuple[str, str, str]:
    """Append a literal, on-the-nose statement to every speech: subtext
    erased by construction. Dialogue must suffer."""
    preamble, blocks = split_scenes(text)
    new_blocks = []
    for block in blocks:
        lines = block.split("\n")
        out = []
        in_dialogue = False
        for line in lines:
            stripped = line.strip()
            if stripped and stripped == stripped.upper() and CUE_LINE.match(stripped) \
                    and not SLUG_LINE.match(stripped):
                in_dialogue = True
                out.append(line)
                continue
            if in_dialogue and not stripped:
                out.append("I am telling you exactly what I feel, and I feel exactly what I am saying.")
                in_dialogue = False
            out.append(line)
        new_blocks.append("\n".join(out))
    return "on_the_nose", "dialogue", join_scenes(preamble, new_blocks)


def inject_content(text: str) -> tuple[str, str, str]:
    """Graphic violence + profanity injected into every 6th scene. The
    content rating must rise (PG-13 scripts must not stay PG-13)."""
    preamble, blocks = split_scenes(text)
    injection = (
        "\nHe smashes the bottle against the bar and drags the broken edge across "
        "the man's throat. Blood sheets down his shirt as he screams a stream of "
        "fucking obscenities at the shitting crowd.\n"
    )
    new_blocks = [
        block + injection if i % 6 == 0 else block
        for i, block in enumerate(blocks)
    ]
    return "content_injected", "content_rating", join_scenes(preamble, new_blocks)


def duplicate_middle(text: str) -> tuple[str, str, str]:
    """Every middle-third scene plays twice, verbatim: pacing must suffer."""
    preamble, blocks = split_scenes(text)
    n = len(blocks)
    lo, hi = n // 3, (2 * n) // 3
    new_blocks = blocks[:lo] + [b for block in blocks[lo:hi] for b in (block, block)] + blocks[hi:]
    return "repetitive_pacing", "structure_pacing", join_scenes(preamble, new_blocks)


ALL_TRANSFORMS = [scramble_structure, remove_protagonist_agency, flatten_dialogue,
                  inject_content, duplicate_middle]


# ------------------------------ thin-signal traps ------------------------------

TRAPS = {
    # A silent chase: zero dialogue. The dialogue dimension has nothing to
    # judge — the honest answer is insufficient_evidence.
    "trap_silent": {
        "target": "dialogue",
        "text": """Title: The Silent Stretch

EXT. SALT FLATS - DAWN

A lone RUNNER pounds across cracked white earth. Behind him, a dust plume: a truck.

EXT. SALT FLATS - CONTINUOUS

The truck gains. The runner cuts left into a dry canal bed.

EXT. DRY CANAL - CONTINUOUS

Loose stones. He stumbles, catches himself, keeps going. The engine echoes off the walls.

EXT. CULVERT MOUTH - MOMENTS LATER

He wedges himself into the dark. The truck idles past. Stops. Reverses slowly.

EXT. SALT FLATS - LATER

Empty land. Far off, tiny, the runner walks alone toward the mountains.
""",
    },
    # A single-scene fragment: no act structure exists to score.
    "trap_fragment": {
        "target": "structure_pacing",
        "text": """Title: One Room

INT. BREAK ROOM - NIGHT

DOTTIE (60s) refills the coffee machine. RAY (20s) watches.

RAY
You've worked here forty years?

DOTTIE
Forty-one.

RAY
Doesn't it wear you down?

DOTTIE
Machine's the one that does the work. I just keep it fed.

She pats the machine. It gurgles.
""",
    },
}


# ------------------------------ corpus assembly -------------------------------

def build(corpus_dir: Path, sources: dict[str, Path] | None = None) -> dict:
    """Fetch/copy real scripts, generate variants and traps, write manifest.

    sources: optional {name: local_path} overrides (skip network).
    Returns the manifest dict.
    """
    corpus_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict = {"items": []}

    texts: dict[str, str] = {}
    for name, url in FETCH_REGISTRY.items():
        target = corpus_dir / f"{name}.fountain"
        if sources and name in sources:
            target.write_text(Path(sources[name]).read_text())
        elif not target.exists():
            try:
                with urllib.request.urlopen(url, timeout=30) as resp:
                    target.write_bytes(resp.read())
            except Exception as exc:  # offline is fine; eval runs on what exists
                print(f"fetch failed for {name}: {exc}")
                continue
        texts[name] = target.read_text()
        manifest["items"].append({
            "id": name, "file": target.name, "kind": "real",
            "ground_truth": GROUND_TRUTH.get(name, {}),
        })

    for name, text in texts.items():
        for transform in ALL_TRANSFORMS:
            variant_name, dimension, transformed = transform(text)
            variant_file = corpus_dir / f"{name}__{variant_name}.fountain"
            variant_file.write_text(transformed)
            manifest["items"].append({
                "id": f"{name}__{variant_name}", "file": variant_file.name,
                "kind": "defect_variant", "clean_id": name,
                "target_dimension": dimension,
            })

    for trap_name, trap in TRAPS.items():
        trap_file = corpus_dir / f"{trap_name}.fountain"
        trap_file.write_text(trap["text"])
        manifest["items"].append({
            "id": trap_name, "file": trap_file.name, "kind": "trap",
            "target_dimension": trap["target"],
        })

    (corpus_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Build the eval corpus")
    parser.add_argument("--dir", required=True)
    parser.add_argument("--source", action="append", default=[],
                        help="name=path local override, e.g. bigfish=/path/big.fountain")
    args = parser.parse_args()
    overrides = dict(s.split("=", 1) for s in args.source)
    manifest = build(Path(args.dir), sources={k: Path(v) for k, v in overrides.items()} or None)
    print(f"{len(manifest['items'])} corpus items in {args.dir}")
