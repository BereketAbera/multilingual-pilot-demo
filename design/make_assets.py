#!/usr/bin/env python3
"""Writes the sample's graphics as SVG source, and packs the icon file.

Standard library only. design/build.sh runs this and then Inkscape; see DESIGN-NOTES.md.

    python3 design/make_assets.py svg            write every SVG (sources into design/build, inline ones into src/assets)
    python3 design/make_assets.py tidy IN OUT    strip an Inkscape export down to shapes and fills
    python3 design/make_assets.py fonts DIR      unpack the project's own IBM Plex files to TTF, for Inkscape
    python3 design/make_assets.py ico OUT PNG..  pack PNG files into one .ico

Nothing is downloaded. The fonts are the WOFF files the app already ships (node_modules/@fontsource);
they are read here to measure text, so every line break in the diagram is worked out, not guessed.
The words in the diagram that come from the app are read from its own files, so the figure cannot
drift from the code: the error codes from contracts/api-error-codes.json and the Portuguese
message from src/i18n/locales/pt-BR/errors.json.
"""

from __future__ import annotations

import json
import re
import struct
import sys
import zlib
from pathlib import Path
from xml.etree import ElementTree
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "design" / "build"
FONTS = ROOT / "node_modules" / "@fontsource"

# The palette is the app's own (src/index.css).
INK = "#16202a"
MUTED = "#4a5763"
LINE = "#d5dbe1"
PAGE = "#f3f5f7"
ACTION = "#0b5cab"
ACTION_TINT = "#e7f0fa"
TOOL = "#5b2dbd"
TOOL_TINT = "#f2edfc"
WHITE = "#ffffff"


# --------------------------------------------------------------------------------------
# Fonts: read the WOFF files the app ships, to measure text and to hand Inkscape a TTF.
# --------------------------------------------------------------------------------------

FONT_FILES = {
    "sans-400": "ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff",
    "sans-500": "ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff",
    "sans-600": "ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff",
    "mono-400": "ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff",
}

# How each face is named: in a browser by family and weight, in Inkscape by the family name
# inside the file (the heavier weights are separate families there).
WEB_FACE = {
    "sans-400": ("'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif", "400"),
    "sans-500": ("'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif", "500"),
    "sans-600": ("'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif", "600"),
    "mono-400": ("'IBM Plex Mono', ui-monospace, monospace", "400"),
}
INKSCAPE_FACE = {
    "sans-400": ("IBM Plex Sans", "400"),
    "sans-500": ("IBM Plex Sans Medium", "400"),
    "sans-600": ("IBM Plex Sans SemiBold", "400"),
    "mono-400": ("IBM Plex Mono", "400"),
}


def read_woff(path: Path) -> tuple[int, dict[str, tuple[bytes, int]]]:
    """The tables of a WOFF 1 file, inflated: tag -> (bytes, checksum)."""
    data = path.read_bytes()
    signature, flavor, _length, count = struct.unpack(">4sIIH", data[:14])
    if signature != b"wOFF":
        raise ValueError(f"{path} is not a WOFF 1 file")
    tables: dict[str, tuple[bytes, int]] = {}
    for index in range(count):
        tag, offset, packed, size, checksum = struct.unpack(">4sIIII", data[44 + index * 20 : 64 + index * 20])
        raw = data[offset : offset + packed]
        tables[tag.decode("latin-1")] = (zlib.decompress(raw) if packed != size else raw, checksum)
    return flavor, tables


def write_ttf(source: Path, target: Path) -> None:
    """The same tables in a plain TrueType wrapper, which is what Inkscape's font lookup reads."""
    flavor, tables = read_woff(source)
    tags = sorted(tables)
    count = len(tags)
    selector = count.bit_length() - 1
    search = (1 << selector) * 16
    header = struct.pack(">IHHHH", flavor, count, search, selector, count * 16 - search)
    offset = 12 + count * 16
    records = b""
    body = b""
    for tag in tags:
        raw, checksum = tables[tag]
        records += struct.pack(">4sIII", tag.encode("latin-1"), checksum, offset, len(raw))
        padded = raw + b"\0" * (-len(raw) % 4)
        body += padded
        offset += len(padded)
    target.write_bytes(header + records + body)


def _u16(data: bytes, at: int) -> int:
    return struct.unpack(">H", data[at : at + 2])[0]


def _character_map(cmap: bytes) -> dict[int, int]:
    """Character code -> glyph number, from the font's Unicode table (format 4)."""
    start_of = None
    for index in range(_u16(cmap, 2)):
        platform, encoding, offset = struct.unpack(">HHI", cmap[4 + index * 8 : 12 + index * 8])
        if _u16(cmap, offset) == 4 and (platform == 0 or (platform, encoding) == (3, 1)):
            start_of = offset
    if start_of is None:
        raise ValueError("no format 4 character map in this font")
    doubled = _u16(cmap, start_of + 6)
    ends = start_of + 14
    starts = ends + doubled + 2
    deltas = starts + doubled
    ranges = deltas + doubled
    mapping: dict[int, int] = {}
    for segment in range(doubled // 2):
        first, last = _u16(cmap, starts + 2 * segment), _u16(cmap, ends + 2 * segment)
        delta, range_offset = _u16(cmap, deltas + 2 * segment), _u16(cmap, ranges + 2 * segment)
        for code in range(first, last + 1):
            if code == 0xFFFF:
                continue
            if range_offset == 0:
                glyph = (code + delta) & 0xFFFF
            else:
                glyph = _u16(cmap, ranges + 2 * segment + range_offset + 2 * (code - first))
                if glyph:
                    glyph = (glyph + delta) & 0xFFFF
            if glyph:
                mapping[code] = glyph
    return mapping


class Font:
    """Advance widths of one face, enough to measure a line of text. Kerning is left out."""

    def __init__(self, key: str) -> None:
        _flavor, tables = read_woff(FONTS / FONT_FILES[key])
        self.key = key
        self.units = _u16(tables["head"][0], 18)
        metrics = _u16(tables["hhea"][0], 34)
        hmtx = tables["hmtx"][0]
        self.advances = [_u16(hmtx, index * 4) for index in range(metrics)]
        self.glyphs = _character_map(tables["cmap"][0])

    def width(self, text: str, size: float) -> float:
        total = 0
        for char in text:
            glyph = self.glyphs.get(ord(char))
            if glyph is None:
                raise ValueError(f"{self.key} has no glyph for {char!r}")
            total += self.advances[min(glyph, len(self.advances) - 1)]
        return total * size / self.units

    def wrap(self, text: str, size: float, room: float) -> list[str]:
        lines: list[str] = []
        current = ""
        for word in text.split():
            candidate = f"{current} {word}".strip()
            if current and self.width(candidate, size) > room:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        for line in lines:
            if self.width(line, size) > room + 0.5:
                raise ValueError(f"{line!r} is wider than {room}px at {size}px in {self.key}")
        return lines


_FONT_CACHE: dict[str, Font] = {}


def font(key: str) -> Font:
    if key not in _FONT_CACHE:
        _FONT_CACHE[key] = Font(key)
    return _FONT_CACHE[key]


# --------------------------------------------------------------------------------------
# The mark: a tally of five. Four uprights and one stroke across them.
# --------------------------------------------------------------------------------------

# In a 32 by 32 box. The uprights sit on odd numbers, so their centres fall on whole pixels
# when the icon is drawn 16 or 32 pixels wide and the four strokes stay four strokes in a browser tab.
UPRIGHTS = (7, 13, 19, 25)
UPRIGHT_TOP, UPRIGHT_BOTTOM = 7, 25
ACROSS = ((4, 21.5), (28, 10.5))  # the fifth stroke, lower left to upper right
STROKE = 2.6
GAP = 1.4  # clear space kept on each side of the fifth stroke where it crosses the others


def _mark_strokes(uprights: str, across: str, behind: str) -> str:
    (x1, y1), (x2, y2) = ACROSS
    four = "".join(f"M{x} {UPRIGHT_TOP}V{UPRIGHT_BOTTOM}" for x in UPRIGHTS)
    fifth = f"M{x1} {y1}L{x2} {y2}"
    return (
        f'<g fill="none" stroke-linecap="round" stroke-width="{STROKE}"><path d="{four}" stroke="{uprights}"/>'
        # Drawn first in the background colour and a little wider, so the fifth stroke reads as lying across the others.
        f'<path d="{fifth}" stroke="{behind}" stroke-width="{STROKE + 2 * GAP:g}"/><path d="{fifth}" stroke="{across}"/></g>'
    )


def mark_svg() -> str:
    """For the header, on white: ink uprights, the fifth stroke in the app's action blue.

    Cropped to the strokes (28 by 24), so at that size on screen every unit here is one pixel.
    """
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 4 28 24">{_mark_strokes(INK, ACTION, WHITE)}</svg>\n'


def favicon_svg() -> str:
    """For the browser tab: white strokes on a blue tile."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        f'<rect width="32" height="32" rx="6" fill="{ACTION}"/>'
        f"{_mark_strokes(WHITE, WHITE, ACTION)}</svg>\n"
    )


def touch_icon_svg() -> str:
    """For a phone's home screen: the same tile with square corners (the phone rounds them) and more margin."""
    scale = 0.78
    shift = 16 * (1 - scale)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        f'<rect width="32" height="32" fill="{ACTION}"/>'
        f'<g transform="translate({shift:.2f} {shift:.2f}) scale({scale})">{_mark_strokes(WHITE, WHITE, ACTION)}</g></svg>\n'
    )


# --------------------------------------------------------------------------------------
# The diagram: where a backend message goes.
# --------------------------------------------------------------------------------------


def _load_words() -> dict[str, str]:
    codes = {entry["code"]: entry for entry in json.loads((ROOT / "contracts/api-error-codes.json").read_text())}
    portuguese = json.loads((ROOT / "src/i18n/locales/pt-BR/errors.json").read_text())
    english = json.loads((ROOT / "src/i18n/locales/en/errors.json").read_text())
    known, unknown = "lot.on_hold", "line.changeover_in_progress"
    if unknown in english:
        raise SystemExit(f"{unknown} now has client text; the diagram's second path needs another example")
    value_names = ", ".join(codes[known]["values"])
    return {
        "known": known,
        "known_status": str(codes[known]["status"]),
        "known_values": value_names,
        "known_text": portuguese[known].replace("{{lotCode}}", "CF-26-0426"),
        "unknown": unknown,
        "unknown_status": str(codes[unknown]["status"]),
    }


COLUMNS = ("What the API sends", "What the client does", "What the user sees", "Where it is counted")

# A cell is a list of (face, text). Sans text is wrapped to the cell; mono text is one line and must fit.
Cell = list[tuple[str, str]]


def _paths(words: dict[str, str]) -> list[dict]:
    return [
        {
            "label": "1. A code the client has text for",
            "note": "the normal case",
            "tone": "action",
            "cells": [
                [("sans-600", f"HTTP {words['known_status']}"), ("mono-400", f"code: {words['known']}"), ("mono-400", f"values: {words['known_values']}")],
                [("sans-400", "Finds the code in its errors file and formats the values for the user’s language.")],
                [("sans-400", words["known_text"])],
                [("sans-400", "Nothing to report.")],
            ],
        },
        {
            "label": "2. A code the client has no text for, or a missing value",
            "note": "fallback; one code is left without text on purpose, to show it",
            "tone": "tool",
            "cells": [
                [("sans-600", f"HTTP {words['unknown_status']}"), ("mono-400", "code:"), ("mono-400", words["unknown"])],
                [("sans-400", "Has no text for this code, so it does not guess.")],
                [("sans-400", "The server’s English detail, marked as English.")],
                [("sans-400", "Listed on Translation status. The strict check fails.")],
            ],
        },
        {
            "label": "3. No code at all",
            "note": "fallback; the stand-in API never does this, so only the screen tests cover it",
            "tone": "tool",
            "cells": [
                [("sans-600", "HTTP 400"), ("mono-400", "title, errors"), ("sans-400", "No code: ASP.NET Core’s default validation answer.")],
                [("sans-400", "Has nothing to translate.")],
                [("sans-400", "The server’s own words on the fields it names, marked as English.")],
                [("sans-400", "Nowhere. A dependency to raise before work starts.")],
            ],
        },
    ]


TITLE = "Where a backend message goes: three paths from the API’s answer to what the user sees"


def _description(words: dict[str, str]) -> str:
    return (
        f"Path 1, the normal case: the API sends HTTP {words['known_status']} with the code "
        f"{words['known']} and its values. The client finds the code in its errors file and formats the values, the user "
        "reads the message in their own language, and there is nothing to report. "
        f"Path 2, a fallback: the API sends a code the client has no text for, or leaves out a value the text needs. In "
        f"the sample {words['unknown']} is left without text on purpose, to show it. The user sees the server’s English detail, marked as English, and the code is listed on "
        "Translation status and fails the strict check. "
        "Path 3, a fallback: the API sends no code at all, only a title and an errors dictionary, which is ASP.NET Core’s "
        "default validation answer. There is nothing to translate, so the server’s own words are shown on the fields it "
        "names. It is counted nowhere, and is a dependency to raise before work starts. The stand-in API never does "
        "this, so only the screen tests cover it."
    )


class Canvas:
    """Collects SVG elements. `faces` decides how a font is named: for a browser or for Inkscape."""

    def __init__(self, faces: dict[str, tuple[str, str]]) -> None:
        self.faces = faces
        self.parts: list[str] = []
        self.boxes: list[str] = []
        self.lines: list[str] = []
        self.heads: list[str] = []
        self.texts: list[str] = []
        self.captions: list[str] = []

    def text(self, x: float, y: float, line: str, face: str, size: float, fill: str) -> None:
        # The root element names the body face, size and colour; a line says only what differs.
        family, weight = self.faces[face]
        base_family, base_weight = self.faces[BASE_FACE]
        attributes = f' x="{x:g}" y="{y:g}"'
        if family != base_family:
            attributes += f' font-family="{family}"'
        if weight != base_weight:
            attributes += f' font-weight="{weight}"'
        if size != BODY:
            attributes += f' font-size="{size:g}"'
        if fill != INK:
            attributes += f' fill="{fill}"'
        self.texts.append(f"<text{attributes}>{escape(line)}</text>")

    def caption(self, x: float, y: float, line: str) -> None:
        """The small muted heading inside a box of the phone drawing; all of them share one look."""
        self.captions.append(f'<text x="{x:g}" y="{y:g}">{escape(line)}</text>')

    def box(self, x: float, y: float, width: float, height: float) -> None:
        self.boxes.append(f'<rect x="{x + 0.5:g}" y="{y + 0.5:g}" width="{width - 1:g}" height="{height - 1:g}" rx="6"/>')

    def arrow(self, x1: float, y1: float, x2: float, y2: float) -> None:
        """A line with an open head. Horizontal or vertical only."""
        head = 4.5
        if y1 == y2:
            tip = f"M{x2 - head:g} {y2 - head:g}L{x2:g} {y2:g}L{x2 - head:g} {y2 + head:g}"
        else:
            tip = f"M{x2 - head:g} {y2 - head:g}L{x2:g} {y2:g}L{x2 + head:g} {y2 - head:g}"
        self.lines.append(f'<path d="M{x1:g} {y1:g}L{x2:g} {y2:g}"/>')
        self.heads.append(f'<path d="{tip}"/>')

    def close_path(self, ink: str, fill: str, dashed: bool) -> None:
        """Ends one of the three paths: its boxes and arrows share one colour and one kind of line."""
        dash = ' stroke-dasharray="4 3"' if dashed else ""
        self.parts.append(f'<g fill="{fill}" stroke="{ink}"{dash}>{"".join(self.boxes)}</g>')
        self.parts.append(f'<g fill="none" stroke="{ink}" stroke-width="1.5"{dash}>{"".join(self.lines)}</g>')
        self.parts.append(
            f'<g fill="none" stroke="{ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">{"".join(self.heads)}</g>'
        )
        if self.captions:
            weight = self.faces["sans-600"]
            named = f' font-family="{weight[0]}"' if weight[0] != self.faces[BASE_FACE][0] else ""
            bold = f' font-weight="{weight[1]}"' if weight[1] != self.faces[BASE_FACE][1] else ""
            self.parts.append(f'<g{named}{bold} font-size="12" fill="{MUTED}">{"".join(self.captions)}</g>')
        self.parts.extend(self.texts)
        self.boxes, self.lines, self.heads, self.texts, self.captions = [], [], [], [], []

    def svg(self, width: float, height: float, ident: str, title: str, description: str | None) -> str:
        """A drawing that stands alone carries its description and a white ground; the inline ones point at the page's copy."""
        self.parts.extend(self.texts)
        family, weight = self.faces[BASE_FACE]
        if description:
            described_by = f"{ident}-desc"
            inside = f'<desc id="{described_by}">{escape(description)}</desc><rect width="{width:g}" height="{height:g}" fill="{WHITE}"/>'
        else:
            described_by, inside = DESCRIPTION_ID, ""
        # Inline in the page, the text takes the page's own sans face; a file on its own has to name one.
        face = f'font-family="{family}" font-weight="{weight}" ' if description else ""
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" width="{width:g}" height="{height:g}" '
            f'{face}font-size="{BODY:g}" fill="{INK}" '
            f'role="img" aria-labelledby="{ident}-title" aria-describedby="{described_by}">'
            f'<title id="{ident}-title">{escape(title)}</title>{inside}{"".join(self.parts)}</svg>\n'
        )


TONES = {
    "action": {"ink": ACTION, "fill": ACTION_TINT, "dashed": False},
    "tool": {"ink": TOOL, "fill": TOOL_TINT, "dashed": True},
}

BASE_FACE = "sans-400"
# The Handoff page holds the long description once, in a hidden paragraph with this id, for both drawings.
DESCRIPTION_ID = "backend-messages-description"
BODY, BODY_LEADING = 13.0, 18.0
MONO = 12.0
PAD_X, PAD_Y = 12.0, 11.0


def _cell_lines(cell: Cell, room: float) -> list[tuple[str, str, float]]:
    """A cell's text as measured lines: (face, text, size)."""
    lines: list[tuple[str, str, float]] = []
    for face, text in cell:
        size = MONO if face.startswith("mono") else BODY
        if face.startswith("mono"):
            if font(face).width(text, size) > room + 0.5:
                raise ValueError(f"{text!r} does not fit in {room}px")
            lines.append((face, text, size))
        else:
            lines.extend((face, line, size) for line in font(face).wrap(text, size, room))
    return lines


def _draw_cell(canvas: Canvas, x: float, y: float, lines: list[tuple[str, str, float]]) -> None:
    baseline = y + PAD_Y + 12.5
    for index, (face, text, size) in enumerate(lines):
        canvas.text(x + PAD_X, baseline + index * BODY_LEADING, text, face, size, INK)


def _cell_height(lines: list[tuple[str, str, float]]) -> float:
    return PAD_Y * 2 + len(lines) * BODY_LEADING - 1


def diagram_wide(faces: dict[str, tuple[str, str]], ident: str, standalone: bool) -> str:
    """Four columns side by side, one row per path. Drawn at the width of the Handoff page's panel."""
    words = _load_words()
    margin = 20.0 if standalone else 0.0
    width = 864.0
    arrow_room = 28.0
    first = 236.0  # the first column holds the longest code on one line
    other = (width - 2 * margin - first - 3 * arrow_room) / 3
    widths = [first, other, other, other]
    lefts = [margin]
    for column in widths[:-1]:
        lefts.append(lefts[-1] + column + arrow_room)

    canvas = Canvas(faces)
    y = margin + 13.0
    for left, heading in zip(lefts, COLUMNS):
        canvas.text(left, y, heading, "sans-600", 13, MUTED)
    y -= 4.0

    for path in _paths(words):
        tone = TONES[path["tone"]]
        y += 34.0
        label_width = font("sans-600").width(path["label"], 13.5)
        canvas.text(margin, y, path["label"], "sans-600", 13.5, tone["ink"])
        canvas.text(margin + label_width + 10, y, path["note"], "sans-400", 12.5, MUTED)
        y += 10.0
        cells = [_cell_lines(cell, column - 2 * PAD_X) for cell, column in zip(path["cells"], widths)]
        height = max(_cell_height(lines) for lines in cells)
        for index, (left, column, lines) in enumerate(zip(lefts, widths, cells)):
            canvas.box(left, y, column, height)
            _draw_cell(canvas, left, y, lines)
            if index:
                canvas.arrow(left - arrow_room + 5, y + height / 2, left - 5, y + height / 2)
        canvas.close_path(tone["ink"], tone["fill"], tone["dashed"])
        y += height
    return canvas.svg(width, y + margin, ident, TITLE, _description(words) if standalone else None)


def diagram_narrow(faces: dict[str, tuple[str, str]], ident: str) -> str:
    """The same three paths for a phone: each path reads top to bottom."""
    words = _load_words()
    width = 320.0
    canvas = Canvas(faces)
    y = 0.0
    for number, path in enumerate(_paths(words)):
        tone = TONES[path["tone"]]
        y += 14.0 if number == 0 else 30.0
        for line in font("sans-600").wrap(path["label"], 13.5, width):
            canvas.text(0, y, line, "sans-600", 13.5, tone["ink"])
            y += 18.0
        for line in font("sans-400").wrap(path["note"], 12.5, width):
            canvas.text(0, y - 1, line, "sans-400", 12.5, MUTED)
            y += 17.0
        y -= 8.0
        for index, (heading, cell) in enumerate(zip(COLUMNS, path["cells"])):
            if index:
                canvas.arrow(22, y + 4, 22, y + 18)
                y += 22.0
            lines = _cell_lines(cell, width - 2 * PAD_X)
            height = _cell_height(lines) + BODY_LEADING
            canvas.box(0, y, width, height)
            canvas.caption(PAD_X, y + PAD_Y + 12.5, heading)
            _draw_cell(canvas, 0, y + BODY_LEADING, lines)
            y += height
        canvas.close_path(tone["ink"], tone["fill"], tone["dashed"])
    return canvas.svg(width, y, ident, TITLE, None)


# --------------------------------------------------------------------------------------
# Commands
# --------------------------------------------------------------------------------------


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)} ({len(text.encode('utf-8'))} bytes)")


def command_svg() -> None:
    # The header's mark: five strokes, as they are.
    write(ROOT / "src/assets/brand/mark.svg", mark_svg())
    # Sources that Inkscape turns into the published files (design/build.sh).
    write(BUILD / "favicon.src.svg", favicon_svg())
    write(BUILD / "touch-icon.src.svg", touch_icon_svg())
    write(BUILD / "backend-messages.src.svg", diagram_wide(INKSCAPE_FACE, "backend-messages", standalone=True))
    # Drawn inline on the Handoff page with the page's own fonts, so the text stays text. The page
    # shows one of the two and holds their shared description once.
    write(ROOT / "src/assets/diagrams/backend-messages-wide.svg", diagram_wide(WEB_FACE, "backend-messages-wide", standalone=False))
    write(ROOT / "src/assets/diagrams/backend-messages-narrow.svg", diagram_narrow(WEB_FACE, "backend-messages-narrow"))
    write(ROOT / "src/assets/diagrams/backend-messages.txt", _description(_load_words()) + "\n")


def _shorter_numbers(data: str) -> str:
    return re.sub(r"-?\d+\.\d{3,}", lambda match: f"{float(match.group()):.3f}".rstrip("0").rstrip("."), data)


def command_tidy(source: Path, target: Path) -> None:
    """Inkscape's export of the mark carries a long style on every shape. Keep the shape and its fill, nothing else."""
    root = ElementTree.parse(source).getroot()
    space = "{http://www.w3.org/2000/svg}"
    shapes = []
    for element in root.iter():
        kind = element.tag.replace(space, "")
        style = dict(part.split(":", 1) for part in element.get("style", "").split(";") if ":" in part)
        fill = style.get("fill") or element.get("fill")
        if kind == "rect":
            radius = f' rx="{element.get("rx")}"' if element.get("rx") else ""
            shapes.append(f'<rect width="{element.get("width")}" height="{element.get("height")}"{radius} fill="{fill}"/>')
        elif kind == "path":
            move = f' transform="{element.get("transform")}"' if element.get("transform") else ""
            shapes.append(f'<path fill="{fill}"{move} d="{_shorter_numbers(element.get("d", ""))}"/>')
        elif kind == "g" and element.get("transform"):
            raise SystemExit("a group with a transform would be lost here; flatten it in the source")
    target.parent.mkdir(parents=True, exist_ok=True)
    text = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{root.get("viewBox")}">{"".join(shapes)}</svg>\n'
    target.write_text(text, encoding="utf-8")
    print(f"wrote {target.relative_to(ROOT)} ({len(text.encode('utf-8'))} bytes, {len(shapes)} shapes)")


def command_fonts(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for key, source in FONT_FILES.items():
        write_ttf(FONTS / source, target / f"{key}.ttf")
    (target / "fonts.conf").write_text(
        '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n'
        f"<fontconfig><dir>{target}</dir><cachedir>{target / 'cache'}</cachedir></fontconfig>\n",
        encoding="utf-8",
    )
    print(f"unpacked {len(FONT_FILES)} fonts to {target}")


def command_ico(target: Path, sources: list[Path]) -> None:
    """An .ico is a small directory followed by the images; PNG data is allowed as it is."""
    images = []
    for source in sources:
        data = source.read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"{source} is not a PNG")
        width, height = struct.unpack(">II", data[16:24])
        images.append((width, height, data))
    offset = 6 + 16 * len(images)
    directory = struct.pack("<HHH", 0, 1, len(images))
    for width, height, data in images:
        directory += struct.pack("<BBBBHHII", width % 256, height % 256, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    target.write_bytes(directory + b"".join(data for _w, _h, data in images))
    print(f"wrote {target.relative_to(ROOT)} ({offset} bytes, {len(images)} sizes)")


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "svg"
    if command == "svg":
        command_svg()
    elif command == "tidy" and len(sys.argv) == 4:
        command_tidy(Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve())
    elif command == "fonts" and len(sys.argv) == 3:
        command_fonts(Path(sys.argv[2]).resolve())
    elif command == "ico" and len(sys.argv) >= 4:
        command_ico(Path(sys.argv[2]).resolve(), [Path(name) for name in sys.argv[3:]])
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
