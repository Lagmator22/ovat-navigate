"""SVG charts for the site, drawn at build time from real numbers.

Every chart is complete static SVG in the page, so it reads with no
JavaScript. site.js only hides the marks of a chart that is below the fold
and plays them back, one by one, when it scrolls into view.

Every number below names its source. Nothing here is invented.
"""
from __future__ import annotations

import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
W, H = 640, 320
ML, MR, MT, MB = 64, 24, 24, 52


def _esc(s) -> str:
    return html.escape(str(s), quote=True)


def _frame(cid, title, desc, inner, dur):
    return (f'<div class="plot-wrap" data-dur="{dur}">'
            f'<svg class="plot" viewBox="0 0 {W} {H}" role="img" aria-labelledby="{cid}-t {cid}-d">'
            f'<title id="{cid}-t">{_esc(title)}</title><desc id="{cid}-d">{_esc(desc)}</desc>'
            f'{inner}</svg></div>')


def _axes(xticks, yticks, sx, sy, xlab, ylab):
    out = []
    for v, label in yticks:
        y = sy(v)
        out.append(f'<line class="gr" x1="{ML}" y1="{y:.1f}" x2="{W - MR}" y2="{y:.1f}"/>')
        out.append(f'<text x="{ML - 10}" y="{y + 4:.1f}" text-anchor="end">{_esc(label)}</text>')
    for v, label in xticks:
        x = sx(v)
        out.append(f'<line class="ax" x1="{x:.1f}" y1="{H - MB}" x2="{x:.1f}" y2="{H - MB + 5}"/>')
        out.append(f'<text x="{x:.1f}" y="{H - MB + 20}" text-anchor="middle">{_esc(label)}</text>')
    out.append(f'<line class="ax" x1="{ML}" y1="{MT}" x2="{ML}" y2="{H - MB}"/>')
    out.append(f'<line class="ax" x1="{ML}" y1="{H - MB}" x2="{W - MR}" y2="{H - MB}"/>')
    if xlab:
        out.append(f'<text x="{(ML + W - MR) / 2:.0f}" y="{H - 8}" text-anchor="middle">{_esc(xlab)}</text>')
    if ylab:
        out.append(f'<text x="14" y="{(MT + H - MB) / 2:.0f}" text-anchor="middle" transform="rotate(-90 14 {(MT + H - MB) / 2:.0f})">{_esc(ylab)}</text>')
    return "".join(out)


def line_chart(cid, title, desc, points, ymax, yticks, xticks, ylab, cls="", dur=3600, fmt=str):
    n = len(points)
    sx = lambda i: ML + (W - ML - MR) * i / (n - 1)
    sy = lambda v: H - MB - (H - MB - MT) * v / ymax
    pts = [(sx(i), sy(v)) for i, (_, v) in enumerate(points)]
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    area = d + f" L{pts[-1][0]:.1f} {H - MB} L{pts[0][0]:.1f} {H - MB} Z"
    marks = []
    for i, ((label, v), (x, y)) in enumerate(zip(points, pts)):
        marks.append(f'<rect class="mk pt {cls}" data-i="{i}" x="{x - 3.5:.1f}" y="{y - 3.5:.1f}" width="7" height="7"><title>{_esc(label)}: {_esc(fmt(v))}</title></rect>')
    lx, ly = pts[-1]
    marks.append(f'<text class="mk val" data-i="{n}" x="{lx - 6:.1f}" y="{ly - 12:.1f}" text-anchor="end">{_esc(fmt(points[-1][1]))}</text>')
    inner = (_axes(xticks, yticks, sx, sy, None, ylab)
             + f'<path class="area" d="{area}"/><path class="ln {cls}" d="{d}"/>' + "".join(marks))
    return _frame(cid, title, desc, inner, dur)


def scatter(cid, title, desc, points, xr, yr, xticks, yticks, xlab, ylab, dur=1600, line=None):
    sx = lambda v: ML + (W - ML - MR) * (v - xr[0]) / (xr[1] - xr[0])
    sy = lambda v: H - MB - (H - MB - MT) * (v - yr[0]) / (yr[1] - yr[0])
    inner = _axes([(v, l) for v, l in xticks], [(v, l) for v, l in yticks], sx, sy, xlab, ylab)
    if line:
        (x1, y1), (x2, y2), label = line
        inner += f'<path class="cap" d="M{sx(x1):.1f} {sy(y1):.1f} L{sx(x2):.1f} {sy(y2):.1f}"/>'
        lx = x1 + (x2 - x1) * 0.42
        ly = y1 + (y2 - y1) * 0.42
        inner += f'<text class="mk" data-i="99" x="{sx(lx) + 10:.1f}" y="{sy(ly) + 4:.1f}">{_esc(label)}</text>'
    for i, (x, y, label, kind, anchor) in enumerate(points):
        px, py = sx(x), sy(y)
        inner += f'<rect class="mk sq {kind}" data-i="{i}" x="{px - 6:.1f}" y="{py - 6:.1f}" width="12" height="12"><title>{_esc(label)}</title></rect>'
        dx = 12 if anchor == "start" else -12
        inner += f'<text class="mk lbl" data-i="{i}" x="{px + dx:.1f}" y="{py + 4:.1f}" text-anchor="{anchor}">{_esc(label)}</text>'
    return _frame(cid, title, desc, inner, dur)


def histogram(cid, title, desc, values, width, top, yticks, xlab, ylab, dur=2400):
    nb = (top + width - 1) // width
    counts = [0] * nb
    for v in values:
        counts[min(v // width, nb - 1)] += 1
    ymax = max(yticks)[0]
    sx = lambda b: ML + (W - ML - MR) * b / nb
    sy = lambda v: H - MB - (H - MB - MT) * v / ymax
    xt = [(b, str(b * width)) for b in range(0, nb + 1, max(1, nb // 5))]
    inner = _axes(xt, yticks, sx, sy, xlab, ylab)
    for b, c in enumerate(counts):
        if not c:
            continue
        x0, x1, y = sx(b) + 1.5, sx(b + 1) - 1.5, sy(c)
        inner += (f'<rect class="mk bar" data-i="{b}" x="{x0:.1f}" y="{y:.1f}" width="{x1 - x0:.1f}" height="{H - MB - y:.1f}">'
                  f'<title>{b * width} to {(b + 1) * width - 1}: {c}</title></rect>')
        inner += f'<text class="mk val" data-i="{b}" x="{(x0 + x1) / 2:.1f}" y="{y - 6:.1f}" text-anchor="middle">{c}</text>'
    return _frame(cid, title, desc, inner, dur)


# ---------------------------------------------------------------- the data

# Weekly snapshots of the ovat repo's main branch (git rev-list --before),
# counting `def test_` in tests/ and lines in ovat/*.py. Computed 2026-10-09.
WEEKS = ["06-05", "06-12", "06-19", "06-26", "07-03", "07-10", "07-17", "07-24", "07-31",
         "08-07", "08-14", "08-21", "08-28", "09-04", "09-11", "09-18", "09-25", "10-02", "10-09"]
TESTS = [12, 29, 29, 44, 112, 176, 176, 176, 499, 556, 684, 705, 705, 705, 705, 705, 705, 705, 807]
LINES = [458, 821, 821, 1159, 2701, 4013, 4013, 4013, 9256, 10134, 12459, 12654, 12654,
         12654, 12654, 12654, 12654, 12654, 13700]
MONTHS = [(0, "Jun"), (4, "Jul"), (9, "Aug"), (13, "Sep"), (17, "Oct")]

# Test functions per file in tests/ on main (git grep -c), 33 files.
TESTS_PER_FILE = [1, 4, 5, 5, 7, 8, 9, 9, 11, 11, 11, 12, 12, 13, 14, 15, 16, 21, 22, 23, 23,
                  25, 26, 29, 30, 31, 32, 36, 38, 57, 76, 76, 99]


def module_sizes():
    """Line counts straight from the codebase map's own data file."""
    text = (ROOT / "assets/js/modules.js").read_text(encoding="utf-8")
    return [int(n) for n in re.findall(r"\bl: (\d+)", text)]


def build(name: str) -> str:
    if name == "tests-over-time":
        return line_chart("c-tests", "Test functions in the suite, week by week",
                          "From 12 test functions on 5 June 2026 to 807 on 9 October 2026, counted weekly on main.",
                          list(zip(WEEKS, TESTS)), 900, [(0, "0"), (300, "300"), (600, "600"), (900, "900")],
                          MONTHS, "test functions", dur=3800)
    if name == "lines-over-time":
        return line_chart("c-lines", "Lines of Python in the ovat package, week by week",
                          "From 458 lines on 5 June 2026 to 13,700 on 9 October 2026, counted weekly on main.",
                          list(zip(WEEKS, LINES)), 15000, [(0, "0"), (5000, "5k"), (10000, "10k"), (15000, "15k")],
                          MONTHS, "lines in ovat/", cls="b", dur=3800, fmt=lambda v: f"{v:,}")
    if name == "bench-scatter":
        pts = [(20.276, 465.8, "native", "", "end"), (17.944, 501.8, "react", "t", "end"),
               (14.211, 604.0, "llamaindex", "o", "start"), (20.182, 485.2, "openai-agents", "w", "end")]
        return scatter("c-bench", "Answer time against peak memory, one run per engine",
                       "native 20.3 s and 465.8 MB, react 17.9 s and 501.8 MB, llamaindex 14.2 s and 604.0 MB, openai-agents 20.2 s and 485.2 MB.",
                       pts, (12, 22), (440, 620), [(12, "12"), (14, "14"), (16, "16"), (18, "18"), (20, "20"), (22, "22 s")],
                       [(450, "450"), (500, "500"), (550, "550"), (600, "600")], "answer time, seconds", "peak MB", dur=1400)
    if name == "npu-cap":
        pts = [(28, 2101, "28 + 2101", "", "start"), (1529, 600, "1529 + 600", "t", "start")]
        return scatter("c-npu", "Prompt tokens against reply tokens on the NPU",
                       "Both measured runs land on the line prompt plus reply equals 2129.",
                       pts, (0, 2400), (0, 2400), [(0, "0"), (600, "600"), (1200, "1200"), (1800, "1800"), (2400, "2400")],
                       [(0, "0"), (600, "600"), (1200, "1200"), (1800, "1800"), (2400, "2400")],
                       "prompt tokens", "reply tokens", dur=1800, line=((0, 2129), (2129, 0), "prompt + reply = 2129"))
    if name == "tests-hist":
        return histogram("c-thist", "How many test functions each test file holds",
                         "33 test files. Most hold fewer than 30 test functions; three hold 76 to 99.",
                         TESTS_PER_FILE, 10, 100, [(0, "0"), (3, "3"), (6, "6"), (9, "9")],
                         "test functions in the file", "files", dur=2200)
    if name == "module-hist":
        sizes = module_sizes()
        return histogram("c-mhist", "How long each module is",
                         f"{len(sizes)} modules. Most are under 400 lines; four are over 1,000.",
                         sizes, 200, 2000, [(0, "0"), (10, "10"), (20, "20"), (30, "30")],
                         "lines in the module", "modules", dur=3000)
    raise KeyError(name)
