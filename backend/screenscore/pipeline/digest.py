"""Deterministic structure + digest building.

The digest is the compressed, structured form of the script that fits in a
local model's context: one entry per scene (slugline, characters, tone,
summary, verbatim notable lines). This is what defeats the
whole-script-in-one-prompt problem.
"""

from dataclasses import dataclass


@dataclass
class Structure:
    scene_count: int
    page_count: int | None
    act_one_end: int  # scene number
    midpoint: int
    act_two_end: int

    def line(self) -> str:
        return (
            f"{self.scene_count} scenes, ~{self.page_count or '?'} pages. "
            f"Estimated act boundaries by position: Act One ends ≈ scene {self.act_one_end}, "
            f"midpoint ≈ scene {self.midpoint}, Act Two ends ≈ scene {self.act_two_end}. "
            f"(Positional estimates, not creative judgments.)"
        )


def build_structure(parsed: dict) -> Structure:
    """Act boundaries from cumulative text volume (≈ page position)."""
    scenes = parsed["scenes"]
    weights = [max(len(s.get("raw_text") or ""), 1) for s in scenes]
    total = sum(weights)
    cumulative = 0.0
    positions: list[float] = []  # fraction of script at each scene's END
    for w in weights:
        cumulative += w
        positions.append(cumulative / total)

    def scene_at(fraction: float) -> int:
        for idx, pos in enumerate(positions):
            if pos >= fraction:
                return scenes[idx]["number"]
        return scenes[-1]["number"]

    return Structure(
        scene_count=len(scenes),
        page_count=parsed.get("page_count") or parsed.get("estimated_page_count"),
        act_one_end=scene_at(0.25),
        midpoint=scene_at(0.5),
        act_two_end=scene_at(0.75),
    )


def digest_text(parsed: dict, scene_maps: dict[int, dict], max_chars: int = 24000) -> str:
    """Render the per-scene digest for prompts.

    scene_maps: scene_number → {"summary", "tone", "notable_lines"} from the
    map pass. Compacts progressively if over budget: drop quoted lines first,
    then summaries (slug-only) — never drops scenes, so citations stay possible.
    """
    for detail in ("full", "no_quotes", "slug_only"):
        rendered = _render_digest(parsed, scene_maps, detail)
        if len(rendered) <= max_chars:
            return rendered
    return rendered[:max_chars]  # pathological; still one line per scene mostly


def _render_digest(parsed: dict, scene_maps: dict[int, dict], detail: str) -> str:
    lines: list[str] = []
    for scene in parsed["scenes"]:
        number = scene["number"]
        mapped = scene_maps.get(number, {})
        chars = _speaking_characters(scene)
        header = f"SC {number} | {scene['slugline']}"
        if chars:
            header += f" | {', '.join(chars[:6])}"
        tone = mapped.get("tone") or []
        if tone and detail != "slug_only":
            header += f" | tone: {', '.join(tone[:3])}"
        lines.append(header)
        if detail != "slug_only" and mapped.get("summary"):
            lines.append(f"  {mapped['summary']}")
        if detail == "full":
            for notable in (mapped.get("notable_lines") or [])[:2]:
                speaker = notable.get("speaker") or "ACTION"
                quote = (notable.get("line") or "").strip()
                if quote:
                    lines.append(f'  » {speaker}: "{quote}"')
    return "\n".join(lines)


def _speaking_characters(scene: dict) -> list[str]:
    seen: dict[str, None] = {}
    for element in scene["elements"]:
        if element["type"] == "dialogue" and element.get("character"):
            seen.setdefault(element["character"])
    return list(seen)


def character_data_text(parsed: dict, max_chars: int = 6000) -> str:
    """Speaking-character stats + sample lines, for prompts."""
    stats: dict[str, dict] = {}
    total_lines = 0
    for scene in parsed["scenes"]:
        for element in scene["elements"]:
            if element["type"] != "dialogue" or not element.get("character"):
                continue
            total_lines += 1
            entry = stats.setdefault(
                element["character"], {"lines": 0, "scenes": [], "samples": []}
            )
            entry["lines"] += 1
            if not entry["scenes"] or entry["scenes"][-1] != scene["number"]:
                entry["scenes"].append(scene["number"])
            if len(entry["samples"]) < 3:
                entry["samples"].append(element["text"])
    out: list[str] = []
    for name in sorted(stats, key=lambda n: -stats[n]["lines"]):
        s = stats[name]
        share = s["lines"] / total_lines if total_lines else 0
        out.append(
            f"{name}: {s['lines']} lines ({share:.0%} of dialogue), "
            f"in {len(s['scenes'])} scenes ({_scene_list(s['scenes'])})"
        )
        for sample in s["samples"]:
            out.append(f'  sample: "{sample}"')
    text = "\n".join(out)
    return text[:max_chars]


def _scene_list(numbers: list[int], limit: int = 12) -> str:
    shown = ", ".join(str(n) for n in numbers[:limit])
    return shown + ("…" if len(numbers) > limit else "")


def excerpts_text(parsed: dict, structure: Structure, per_excerpt_chars: int = 2000) -> str:
    """Verbatim excerpts: opening, midpoint, ending, and the most
    dialogue-heavy scene — the raw text specialists can quote from."""
    scenes_by_number = {s["number"]: s for s in parsed["scenes"]}
    picks: dict[int, str] = {}

    def add(number: int, label: str) -> None:
        scene = scenes_by_number.get(number)
        if scene and number not in picks:
            picks[number] = label

    add(parsed["scenes"][0]["number"], "OPENING")
    add(structure.midpoint, "MIDPOINT")
    add(parsed["scenes"][-1]["number"], "ENDING")
    dialogue_heavy = max(
        parsed["scenes"],
        key=lambda s: sum(1 for e in s["elements"] if e["type"] == "dialogue"),
    )
    add(dialogue_heavy["number"], "DIALOGUE-HEAVY")

    blocks = []
    for number in sorted(picks):
        scene = scenes_by_number[number]
        text = (scene.get("raw_text") or "").strip()[:per_excerpt_chars]
        blocks.append(f"[{picks[number]} — SCENE {number}]\n{text}")
    return "\n\n".join(blocks)


def production_signals_text(parsed: dict) -> str:
    """Countable production facts for the commercial synthesis."""
    locations: dict[str, None] = {}
    night_ext = 0
    for scene in parsed["scenes"]:
        if scene.get("location"):
            locations.setdefault(scene["location"].upper())
        tod = (scene.get("time_of_day") or "").upper()
        if scene.get("int_ext") in ("EXT", "INT/EXT") and ("NIGHT" in tod or "DUSK" in tod):
            night_ext += 1
    speaking = len(
        {e["character"] for s in parsed["scenes"] for e in s["elements"] if e["type"] == "dialogue" and e.get("character")}
    )
    return (
        f"{len(parsed['scenes'])} scenes; {len(locations)} distinct locations; "
        f"{speaking} speaking characters; {night_ext} night/dusk exteriors."
    )
