"""Report exporters: Markdown and PDF (JSON export is the raw report file).

Both render from the immutable report JSON — the same contract the UI
consumes — so exports never drift from what the user saw on screen.
"""

from fpdf import FPDF

SCORE_LABELS = {"weak": "Weak", "fair": "Fair", "good": "Good", "excellent": "Excellent"}


def _score(dim: dict) -> str:
    if dim.get("insufficient_evidence") or not dim.get("score"):
        return "Insufficient evidence"
    return SCORE_LABELS.get(dim["score"], dim["score"].title())


def export_filename(report: dict, ext: str) -> str:
    title = report["header"]["title"] or "screenplay"
    safe = "".join(c for c in title if c.isalnum() or c in " -_").strip() or "screenplay"
    return f"{safe} - ScreenScore coverage.{ext}"


# -- markdown -------------------------------------------------------------------

def to_markdown(report: dict) -> str:
    header = report["header"]
    rec = report["recommendation"]
    lines: list[str] = []
    add = lines.append

    add(f"# {header['title']} — Script Coverage")
    meta_bits = []
    if header.get("writers"):
        meta_bits.append(f"by {', '.join(header['writers'])}")
    if header.get("page_count"):
        meta_bits.append(f"{header['page_count']} pages")
    if header.get("scene_count"):
        meta_bits.append(f"{header['scene_count']} scenes")
    if header.get("genres"):
        meta_bits.append(", ".join(g["name"] for g in header["genres"]))
    if meta_bits:
        add(f"*{' · '.join(meta_bits)}*")
    add("")
    add(f"**Recommendation: {rec['verdict'].upper()}** — {rec['rationale']}")
    add("")
    add(f"**Logline.** {report['logline']}")
    add("")

    add("## Scorecard")
    add("")
    add("| Dimension | Score |")
    add("|---|---|")
    for dim in report["rubric"]:
        add(f"| {dim['name']} | {_score(dim)} |")
    add("")

    for dim in report["rubric"]:
        add(f"### {dim['name']} — {_score(dim)}")
        add("")
        add(dim["rationale"])
        for ev in dim.get("evidence", []):
            note = f" *({ev['note']})*" if ev.get("note") else ""
            add(f"> Scene {ev['scene_number']}: “{ev['quote']}”{note}")
        add("")

    add("## Synopsis")
    add("")
    if report["synopsis"].get("overview"):
        add(report["synopsis"]["overview"])
        add("")
    for act in report["synopsis"]["acts"]:
        add(f"**{act['act']}.** {act['summary']}")
        add("")

    add("## Characters")
    add("")
    for c in report["characters"]["principals"]:
        share = f" — {c['dialogue_share']:.0%} of dialogue" if c.get("dialogue_share") else ""
        add(f"- **{c['name']}**{share}: {c['description']} {c['arc_summary']}".rstrip())
    add("")

    if report["scene_notes"]:
        add("## Scene notes")
        add("")
        for note in report["scene_notes"]:
            add(f"- **Scene {note['scene_number']}** ({note['kind']}): {note['note']}")
        add("")

    add("## Commercial")
    add("")
    comps = report["comps"]
    if comps["items"]:
        add(f"**Comparables** *({comps['disclaimer']})*")
        for comp in comps["items"]:
            year = f" ({comp['year']})" if comp.get("year") else ""
            add(f"- {comp['title']}{year} — {comp['reason']}")
        add("")
    budget = report["budget_tier"]
    add(f"**Budget tier:** {budget['tier']} — {'; '.join(budget['drivers'])}")
    add("")
    rating = report["content_rating"]
    add(f"**Content rating (estimated):** {rating['estimated']}")
    for driver in rating["drivers"]:
        add(f"- {driver['category'].replace('_', ' ')}: {driver['detail']}")
    add("")

    meta = report["meta"]
    stub_note = " · development model (placeholder judgments)" if meta.get("stub") else ""
    add("---")
    add(
        f"*Generated locally by ScreenScore {meta['engine_version']} · prompts "
        f"{meta['prompt_version']} · models {meta['models'].get('worker')} / "
        f"{meta['models'].get('reasoning')}{stub_note}. Nothing left this machine.*"
    )
    return "\n".join(lines)


# -- pdf --------------------------------------------------------------------------

def _latin(text: str) -> str:
    """fpdf core fonts are latin-1; transliterate the usual suspects."""
    replacements = {
        "‘": "'", "’": "'", "“": '"', "”": '"',
        "–": "-", "—": "--", "…": "...", " ": " ",
        "•": "-", "→": "->",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", errors="replace").decode("latin-1")


class _CoveragePdf(FPDF):
    MARGIN = 18

    def __init__(self) -> None:
        super().__init__(format="A4")
        self.set_margins(self.MARGIN, self.MARGIN)
        self.set_auto_page_break(True, margin=self.MARGIN)

    def h1(self, text: str) -> None:
        self.set_font("helvetica", "B", 20)
        self.multi_cell(0, 9, _latin(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def h2(self, text: str) -> None:
        self.ln(3)
        self.set_font("helvetica", "B", 13)
        self.multi_cell(0, 7, _latin(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def h3(self, text: str) -> None:
        self.ln(2)
        self.set_font("helvetica", "B", 11)
        self.multi_cell(0, 6, _latin(text), new_x="LMARGIN", new_y="NEXT")

    def body(self, text: str, size: int = 10, style: str = "") -> None:
        self.set_font("helvetica", style, size)
        self.multi_cell(0, 5.2, _latin(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(0.5)

    def quote(self, text: str) -> None:
        self.set_x(self.MARGIN + 6)
        self.set_font("helvetica", "I", 9.5)
        self.set_text_color(90, 90, 90)
        self.multi_cell(0, 5, _latin(text), new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)
        self.ln(0.5)


def to_pdf(report: dict) -> bytes:
    header = report["header"]
    rec = report["recommendation"]
    pdf = _CoveragePdf()
    pdf.add_page()

    pdf.h1(header["title"])
    meta_bits = []
    if header.get("writers"):
        meta_bits.append(f"by {', '.join(header['writers'])}")
    if header.get("page_count"):
        meta_bits.append(f"{header['page_count']} pages")
    if header.get("scene_count"):
        meta_bits.append(f"{header['scene_count']} scenes")
    if header.get("genres"):
        meta_bits.append(", ".join(g["name"] for g in header["genres"]))
    if meta_bits:
        pdf.body(" · ".join(meta_bits), size=9.5, style="I")

    pdf.h2(f"Recommendation: {rec['verdict'].upper()}")
    pdf.body(rec["rationale"])
    pdf.h3("Logline")
    pdf.body(report["logline"])

    pdf.h2("Scorecard")
    for dim in report["rubric"]:
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(120, 6, _latin(dim["name"]))
        pdf.set_font("helvetica", "", 10)
        pdf.cell(0, 6, _latin(_score(dim)), new_x="LMARGIN", new_y="NEXT")

    for dim in report["rubric"]:
        pdf.h3(f"{dim['name']} — {_score(dim)}")
        pdf.body(dim["rationale"])
        for ev in dim.get("evidence", []):
            pdf.quote(f'Scene {ev["scene_number"]}: "{ev["quote"]}"')

    pdf.h2("Synopsis")
    if report["synopsis"].get("overview"):
        pdf.body(report["synopsis"]["overview"])
    for act in report["synopsis"]["acts"]:
        pdf.h3(act["act"])
        pdf.body(act["summary"])

    pdf.h2("Characters")
    for c in report["characters"]["principals"]:
        share = f" - {c['dialogue_share']:.0%} of dialogue" if c.get("dialogue_share") else ""
        pdf.h3(f"{c['name']}{share}")
        pdf.body(f"{c['description']} {c['arc_summary']}".strip())

    if report["scene_notes"]:
        pdf.h2("Scene notes")
        for note in report["scene_notes"]:
            pdf.h3(f"Scene {note['scene_number']} ({note['kind']})")
            pdf.body(note["note"])

    pdf.h2("Commercial")
    comps = report["comps"]
    if comps["items"]:
        pdf.h3("Comparables")
        pdf.body(comps["disclaimer"], size=8.5, style="I")
        for comp in comps["items"]:
            year = f" ({comp['year']})" if comp.get("year") else ""
            pdf.body(f"- {comp['title']}{year} — {comp['reason']}")
    pdf.h3("Budget tier")
    pdf.body(f"{report['budget_tier']['tier']} — {'; '.join(report['budget_tier']['drivers'])}")
    pdf.h3("Content rating (estimated)")
    pdf.body(report["content_rating"]["estimated"])
    for driver in report["content_rating"]["drivers"]:
        pdf.body(f"- {driver['category'].replace('_', ' ')}: {driver['detail']}", size=9.5)

    meta = report["meta"]
    stub_note = " · development model (placeholder judgments)" if meta.get("stub") else ""
    pdf.ln(4)
    pdf.body(
        f"Generated locally by ScreenScore {meta['engine_version']} · prompts "
        f"{meta['prompt_version']} · models {meta['models'].get('worker')} / "
        f"{meta['models'].get('reasoning')}{stub_note}. Nothing left this machine.",
        size=8, style="I",
    )
    return bytes(pdf.output())
