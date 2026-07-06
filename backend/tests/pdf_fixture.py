"""Builds a minimal, valid, Courier-typeset PDF entirely by hand — enough for
pdfplumber to extract text with layout, without adding a PDF-writing
dependency. Each page is a list of (column, text) lines, one line per row.
"""

CHAR_W = 7.2  # Courier 12pt advance width
LEFT = 72.0
TOP = 720.0
LEADING = 12.0


def _escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def _content_stream(lines: list[tuple[int, str]]) -> bytes:
    ops = []
    y = TOP
    for col, text in lines:
        if text:
            x = LEFT + col * CHAR_W
            ops.append(f"BT /F1 12 Tf 1 0 0 1 {x:.1f} {y:.1f} Tm ({_escape(text)}) Tj ET")
        y -= LEADING
    return "\n".join(ops).encode("latin-1")


def build_pdf(pages: list[list[tuple[int, str]]]) -> bytes:
    """pages: one list of (column, text) rows per page."""
    objects: list[bytes] = []
    page_count = len(pages)
    # Object numbering: 1 catalog, 2 pages, 3 font, then per page i:
    # (4+2i) page object, (5+2i) its content stream.
    kids = " ".join(f"{4 + 2 * i} 0 R" for i in range(page_count))
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {page_count} >>".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")
    for i, page_lines in enumerate(pages):
        stream = _content_stream(page_lines)
        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 3 0 R >> >> /Contents {5 + 2 * i} 0 R >>"
            ).encode()
        )
        objects.append(
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"
        )

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF\n"
    ).encode()
    return bytes(out)


def screenplay_pdf() -> bytes:
    """A two-page, production-formatted screenplay PDF with page furniture."""
    page1 = [
        (0, ""),
        (25, "THE LONG RAIN"),
        (0, ""),
        (0, "EXT. COASTAL HIGHWAY - NIGHT"),
        (0, ""),
        (0, "Rain hammers a lone pickup truck."),
        (0, ""),
        (22, "MARA (V.O.)"),
        (10, "Everyone said the lighthouse was"),
        (10, "automated."),
        (0, ""),
        (45, "(CONTINUED)"),
    ]
    page2 = [
        (35, "2."),
        (0, "CONTINUED:"),
        (0, ""),
        (0, "INT. LIGHTHOUSE - CONTINUOUS"),
        (0, ""),
        (0, "A spiral staircase. Mara climbs."),
        (0, ""),
        (22, "KEELER (O.S.)"),
        (10, "You the new keeper?"),
        (0, ""),
        (22, "MARA"),
        (16, "(beat)"),
        (10, "Just the storm cover."),
        (0, ""),
        (0, "FADE OUT."),
    ]
    return build_pdf([page1, page2])
