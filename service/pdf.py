"""Small PDF renderer for ATS-friendly resume drafts.

The service only needs plain, single-column PDF output. A tiny renderer keeps the
backend dependency-free while still returning a valid application/pdf payload.
"""

from __future__ import annotations

from textwrap import wrap

PAGE_WIDTH = 612
PAGE_HEIGHT = 792
LEFT_MARGIN = 54
TOP_MARGIN = 744
LINE_HEIGHT = 14
LINES_PER_PAGE = 50
WRAP_WIDTH = 92


def _escape_pdf_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .encode("latin-1", "replace")
        .decode("latin-1")
    )


def _paginate(text: str) -> list[list[str]]:
    lines: list[str] = []
    for raw_line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw_line.strip()
        if not line:
            lines.append("")
            continue

        lines.extend(wrap(line, width=WRAP_WIDTH, break_long_words=False) or [""])

    pages = [lines[index : index + LINES_PER_PAGE] for index in range(0, len(lines), LINES_PER_PAGE)]
    return pages or [[""]]


def _content_stream(lines: list[str]) -> bytes:
    commands = [
        "BT",
        "/F1 10 Tf",
        f"{LEFT_MARGIN} {TOP_MARGIN} Td",
        f"{LINE_HEIGHT} TL",
    ]
    commands.extend(f"({_escape_pdf_text(line)}) Tj T*" for line in lines)
    commands.append("ET")
    return "\n".join(commands).encode("latin-1", "replace")


def render_pdf(text: str) -> bytes:
    """Render plain text into a valid PDF document."""

    pages = _paginate(text)
    font_ref = 3 + len(pages) * 2
    objects: dict[int, bytes] = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        font_ref: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }

    page_refs: list[int] = []
    for page_index, lines in enumerate(pages):
        page_ref = 3 + page_index * 2
        content_ref = page_ref + 1
        stream = _content_stream(lines)
        page_refs.append(page_ref)
        objects[page_ref] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 {font_ref} 0 R >> >> /Contents {content_ref} 0 R >>"
        ).encode("ascii")
        objects[content_ref] = b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream"

    kids = " ".join(f"{page_ref} 0 R" for page_ref in page_refs)
    objects[2] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_refs)} >>".encode("ascii")

    body = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for object_id in range(1, max(objects) + 1):
        offsets.append(len(body))
        body.extend(f"{object_id} 0 obj\n".encode("ascii"))
        body.extend(objects[object_id])
        body.extend(b"\nendobj\n")

    xref_offset = len(body)
    body.extend(f"xref\n0 {len(offsets)}\n".encode("ascii"))
    body.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        body.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    body.extend(
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    return bytes(body)

