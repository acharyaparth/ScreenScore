"""PDF → text → heuristic parser.

pdfplumber with layout=True preserves horizontal positioning as spaces, which
the text parser's indentation profiling depends on to tell dialogue from
action. The true page count is kept (the one thing PDFs give us for free).
"""

import io

import pdfplumber

from .models import ParsedScreenplay
from .text import parse_text


def parse_pdf(data: bytes) -> ParsedScreenplay:
    pages: list[str] = []
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            page_count = len(pdf.pages)
            for page in pdf.pages:
                pages.append(page.extract_text(layout=True) or "")
    except Exception as exc:
        result = ParsedScreenplay(source_format="pdf", title=None, authors=[], scenes=[])
        result.warnings.append(f"could not read PDF: {exc}")
        return result

    text = "\n".join(pages)
    result = parse_text(text, source_format="pdf", page_count=page_count)
    if text.strip() == "":
        result.warnings.append(
            "PDF contains no extractable text — it may be a scan; OCR is not supported yet"
        )
    return result
