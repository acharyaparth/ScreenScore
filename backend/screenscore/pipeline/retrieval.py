"""Targeted retrieval: give each dimension specialist the script material that
dimension actually needs, not just the generic digest.

All retrieval here is deterministic (position, counts, keyword scans) — no
embeddings, no extra models. Everything quoted is verbatim script text, so
anything a specialist cites from these packs survives evidence verification.
"""

import re

from .digest import Structure

EFFECTS_KEYWORDS = re.compile(
    r"\b(explod\w*|explosion|crash\w*|gunfire|helicopter|creature|monster|storm|"
    r"flood\w*|fire|burn\w*|collapse\w*|chase|stunt\w*|underwater|drown\w*|"
    r"crowd of|hundreds of|army|battle|transform\w*|vfx|cgi)\b",
    re.IGNORECASE,
)

CONTENT_CATEGORIES: dict[str, re.Pattern] = {
    "language": re.compile(
        r"\b(fuck\w*|shit\w*|goddamn\w*|bitch\w*|asshole\w*|bastard\w*|cocksucker\w*)\b", re.IGNORECASE
    ),
    "violence": re.compile(
        r"\b(kill\w*|blood\w*|gun\w*|shoot\w*|shot|stab\w*|corpse|strangl\w*|beat\w* (him|her)|"
        r"punch\w*|throat|wound\w*|murder\w*|dead body)\b", re.IGNORECASE
    ),
    "sexual_content": re.compile(
        r"\b(naked|nude|undress\w*|sex|breasts?|thrust\w*|moan\w*|orgasm\w*)\b", re.IGNORECASE
    ),
    "substances": re.compile(
        r"\b(whiskey|bourbon|vodka|beer|drunk|wasted|cocaine|heroin|meth|joint|"
        r"cigarette\w*|pills|needle|overdose|high as)\b", re.IGNORECASE
    ),
}


def char_budget(num_ctx: int, response_reserve_tokens: int = 1200, template_chars: int = 2200) -> int:
    """Total characters of *variable* prompt material that fit in num_ctx.

    ~3.3 chars/token for English prose. Getting this wrong is silent: the
    runtime front-truncates over-long prompts, which eats the instructions.
    """
    return max(6000, int((num_ctx - response_reserve_tokens) * 3.3) - template_chars)


# -- shared building blocks ----------------------------------------------------

def _scene_excerpt(scene: dict, max_chars: int = 1400) -> str:
    text = (scene.get("raw_text") or "").strip()[:max_chars]
    return f"[SCENE {scene['number']} — {scene['slugline']}]\n{text}"


def _scenes_by_number(parsed: dict) -> dict[int, dict]:
    return {s["number"]: s for s in parsed["scenes"]}


def _line_hits(parsed: dict, pattern: re.Pattern, limit: int) -> list[tuple[int, str]]:
    """(scene_number, verbatim line) for lines matching pattern."""
    hits: list[tuple[int, str]] = []
    for scene in parsed["scenes"]:
        for element in scene["elements"]:
            text = element.get("text") or ""
            if pattern.search(text):
                hits.append((scene["number"], text.strip()))
                if len(hits) >= limit:
                    return hits
    return hits


def content_scan(parsed: dict, per_category: int = 12) -> dict[str, list[tuple[int, str]]]:
    """Rating-driver evidence: verbatim lines that trip content categories."""
    return {
        category: _line_hits(parsed, pattern, per_category)
        for category, pattern in CONTENT_CATEGORIES.items()
    }


def pacing_table(parsed: dict, structure: Structure) -> str:
    scenes = parsed["scenes"]
    weights = [max(len(s.get("raw_text") or ""), 1) for s in scenes]
    total = sum(weights)
    lines = [
        f"Acts by position: Act One = scenes 1–{structure.act_one_end}, "
        f"Act Two = {structure.act_one_end + 1}–{structure.act_two_end} "
        f"(midpoint ≈ scene {structure.midpoint}), "
        f"Act Three = {structure.act_two_end + 1}–{scenes[-1]['number']}."
    ]
    for label, lo, hi in (
        ("Act One", 1, structure.act_one_end),
        ("Act Two", structure.act_one_end + 1, structure.act_two_end),
        ("Act Three", structure.act_two_end + 1, scenes[-1]["number"]),
    ):
        act_weight = sum(w for s, w in zip(scenes, weights) if lo <= s["number"] <= hi)
        act_count = sum(1 for s in scenes if lo <= s["number"] <= hi)
        lines.append(f"{label}: {act_count} scenes, {act_weight / total:.0%} of the script by volume.")
    longest = sorted(zip(scenes, weights), key=lambda p: -p[1])[:8]
    lines.append("Longest scenes: " + ", ".join(
        f"SC {s['number']} ({w / total:.1%})" for s, w in longest
    ))
    return "\n".join(lines)


def production_table(parsed: dict) -> str:
    locations: dict[str, int] = {}
    int_count = ext_count = night_ext = 0
    for scene in parsed["scenes"]:
        if scene.get("location"):
            key = scene["location"].upper()
            locations[key] = locations.get(key, 0) + 1
        ie = scene.get("int_ext")
        if ie == "INT":
            int_count += 1
        elif ie in ("EXT", "INT/EXT"):
            ext_count += 1
            tod = (scene.get("time_of_day") or "").upper()
            if "NIGHT" in tod or "DUSK" in tod:
                night_ext += 1
    top = sorted(locations.items(), key=lambda kv: -kv[1])[:15]
    lines = [
        f"{len(parsed['scenes'])} scenes; {len(locations)} distinct locations; "
        f"{int_count} INT / {ext_count} EXT; {night_ext} night/dusk exteriors.",
        "Most-used locations: " + ", ".join(f"{name} ({count})" for name, count in top),
    ]
    effects = _line_hits(parsed, EFFECTS_KEYWORDS, 10)
    if effects:
        lines.append("Effects/scale flags (verbatim lines):")
        lines += [f'  SC {n}: "{line}"' for n, line in effects]
    return "\n".join(lines)


def _character_roster(parsed: dict, top_n: int = 10) -> list[tuple[str, int, list[int]]]:
    stats: dict[str, tuple[int, list[int]]] = {}
    for scene in parsed["scenes"]:
        for element in scene["elements"]:
            if element["type"] == "dialogue" and element.get("character"):
                count, scenes_list = stats.get(element["character"], (0, []))
                if not scenes_list or scenes_list[-1] != scene["number"]:
                    scenes_list = scenes_list + [scene["number"]]
                stats[element["character"]] = (count + 1, scenes_list)
    ranked = sorted(stats.items(), key=lambda kv: -kv[1][0])[:top_n]
    return [(name, count, scenes_list) for name, (count, scenes_list) in ranked]


def character_material(parsed: dict, max_chars: int) -> str:
    """Top characters: their first and last scenes plus sample dialogue."""
    by_number = _scenes_by_number(parsed)
    blocks: list[str] = []
    for name, count, scene_numbers in _character_roster(parsed, top_n=3):
        samples = []
        for scene in parsed["scenes"]:
            for element in scene["elements"]:
                if element["type"] == "dialogue" and element.get("character") == name:
                    samples.append(f'  SC {scene["number"]}: "{element["text"]}"')
            if len(samples) >= 6:
                break
        first, last = scene_numbers[0], scene_numbers[-1]
        blocks.append(
            f"{name} — {count} lines, first appears SC {first}, last SC {last}.\n"
            + "\n".join(samples[:6])
            + "\n" + _scene_excerpt(by_number[last], 700)
        )
    return "\n\n".join(blocks)[:max_chars]


def dialogue_material(parsed: dict, max_chars: int) -> str:
    """The most dialogue-dense scenes, verbatim."""
    dense = sorted(
        parsed["scenes"],
        key=lambda s: -sum(1 for e in s["elements"] if e["type"] == "dialogue"),
    )[:3]
    return "\n\n".join(_scene_excerpt(s, max_chars // 3) for s in dense)[:max_chars]


def bookend_material(parsed: dict, max_chars: int) -> str:
    scenes = parsed["scenes"]
    picks = [scenes[0], scenes[-1]]
    return "\n\n".join(_scene_excerpt(s, max_chars // 2) for s in picks)[:max_chars]


def content_material(parsed: dict, max_chars: int) -> str:
    lines = ["Speaking cast (dialogue lines, scene spread):"]
    for name, count, scene_numbers in _character_roster(parsed, top_n=10):
        lines.append(f"  {name}: {count} lines across {len(scene_numbers)} scenes")
    scan = content_scan(parsed, per_category=6)
    for category, hits in scan.items():
        if hits:
            lines.append(f"{category.replace('_', ' ')} flags (verbatim):")
            lines += [f'  SC {n}: "{line}"' for n, line in hits]
    return "\n".join(lines)[:max_chars]


def dimension_context(dim_id: str, parsed: dict, structure: Structure, max_chars: int) -> str:
    """The per-dimension supplement handed to that specialist alongside the
    digest. Unknown dimensions get an empty pack (extensibility: adding a
    dimension without a pack still works)."""
    by_number = _scenes_by_number(parsed)
    if dim_id == "structure_pacing":
        boundary = [
            by_number.get(structure.act_one_end),
            by_number.get(structure.midpoint),
            by_number.get(structure.act_two_end),
        ]
        excerpts = "\n\n".join(_scene_excerpt(s, 700) for s in boundary if s)
        return (pacing_table(parsed, structure) + "\n\n" + excerpts)[:max_chars]
    if dim_id == "characterization":
        return character_material(parsed, max_chars)
    if dim_id == "dialogue":
        return dialogue_material(parsed, max_chars)
    if dim_id in ("premise_originality", "theme_resonance"):
        return bookend_material(parsed, max_chars)
    if dim_id == "production_complexity":
        return production_table(parsed)[:max_chars]
    if dim_id == "representation_content":
        return content_material(parsed, max_chars)
    if dim_id == "marketability":
        return (production_table(parsed) + "\n\n" + bookend_material(parsed, max_chars // 2))[:max_chars]
    return ""
