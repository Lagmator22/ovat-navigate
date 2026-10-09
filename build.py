#!/usr/bin/env python3
"""Build the static site: wrap each src/*.html body in the shared layout.

Why a build step at all: five pages share one header, one footer and one
security policy. Copying them by hand is how they drift. This script is the
only place they are written, and its output is committed, so GitHub Pages
serves plain static files with no build on its side.

Usage:  python3 build.py
Input:  src/<page>.html, each starting with a small header block:
            <!--
            title: Page title
            description: One sentence.
            nav: home | architecture | guide | results | codebase | none
            scripts: flow.js terminal.js
            -->
Output: <page>.html in the repo root, plus sitemap.xml.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
BASE_URL = "https://lagmator22.github.io/ovat-navigate/"
REPO = "https://github.com/Lagmator22/ovat"
SITE_REPO = "https://github.com/Lagmator22/ovat-navigate"

# One policy for every page. No inline script, no inline style, nothing from
# another origin. frame-ancestors cannot be set from a <meta> tag; see SECURITY.md.
CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; "
       "font-src 'self'; connect-src 'none'; media-src 'self'; object-src 'none'; "
       "frame-src 'none'; worker-src 'none'; manifest-src 'self'; base-uri 'none'; "
       "form-action 'none'; upgrade-insecure-requests")

NAV = [
    ("home", "index.html", "Overview"),
    ("architecture", "architecture.html", "Architecture"),
    ("guide", "guide.html", "Guide"),
    ("results", "results.html", "Results"),
    ("codebase", "codebase.html", "Codebase"),
]

BRAND_MARK = """<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
  <rect class="bm-frame" x="1" y="1" width="30" height="30" rx="8"/>
  <circle class="bm-ring" cx="16" cy="16" r="8"/>
  <circle class="bm-dot" cx="24" cy="16" r="3"/>
</svg>"""

ICON_SUN = """<svg class="theme-ico-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>"""
ICON_MOON = """<svg class="theme-ico-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>"""
ICON_GH = """<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.7.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1.1 1.5 1.1.9 1.6 2.4 1.1 2.9.8.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10.2 10.2 0 0 0 22 12.2C22 6.6 17.5 2 12 2z"/></svg>"""


def header(nav_key: str) -> str:
    items = []
    for key, href, label in NAV:
        current = ' aria-current="page"' if key == nav_key else ""
        items.append(f'<li><a href="{href}"{current}>{label}</a></li>')
    return f"""<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap top-inner">
    <a class="brand" href="index.html" aria-label="OVAT Navigate, home">
      {BRAND_MARK}
      <span class="brand-word">ovat</span>
      <span class="brand-tag">navigate</span>
    </a>
    <nav class="nav" aria-label="Main">
      <ul>{''.join(items)}</ul>
    </nav>
    <div class="top-actions">
      <button class="icon-btn" id="theme-toggle" type="button" aria-pressed="false" aria-label="Switch to light theme">{ICON_SUN}{ICON_MOON}</button>
      <a class="icon-btn" href="{REPO}" rel="noopener" aria-label="OVAT on GitHub">{ICON_GH}</a>
    </div>
  </div>
</header>"""


FOOTER = f"""<footer class="foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="index.html" aria-label="OVAT Navigate, home">{BRAND_MARK}<span class="brand-word">ovat</span></a>
        <p class="foot-about">A visual guide to the OpenVINO Agentic Toolkit, a Google Summer of Code 2026 project for OpenVINO by Gurman (<a href="https://github.com/Lagmator22" rel="noopener">Lagmator22</a>). Every fact here comes from the OVAT source and its design notes.</p>
      </div>
      <div>
        <h2>This site</h2>
        <ul>
          <li><a href="architecture.html">Architecture</a></li>
          <li><a href="guide.html">Guide</a></li>
          <li><a href="results.html">Measured results</a></li>
          <li><a href="codebase.html">Codebase map</a></li>
        </ul>
      </div>
      <div>
        <h2>Project</h2>
        <ul>
          <li><a href="{REPO}" rel="noopener">Source on GitHub</a></li>
          <li><a href="https://pypi.org/project/ovat/" rel="noopener">ovat on PyPI</a></li>
          <li><a href="{REPO}/blob/main/docs/ARCHITECTURE.md" rel="noopener">ARCHITECTURE.md</a></li>
          <li><a href="{REPO}/blob/main/docs/workflow_yaml_reference.md" rel="noopener">workflow.yml reference</a></li>
        </ul>
      </div>
      <div>
        <h2>About</h2>
        <ul>
          <li><a href="{SITE_REPO}" rel="noopener">Site source</a></li>
          <li><a href="{SITE_REPO}/blob/main/SECURITY.md" rel="noopener">Security</a></li>
          <li><a href="{SITE_REPO}/tree/main/assets/fonts" rel="noopener">Font licenses</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-base">
      <span>Describes OVAT 1.1.1. Apache 2.0.</span>
      <span>Not an official Intel or OpenVINO site. Intel and OpenVINO are trademarks of Intel Corporation.</span>
    </div>
  </div>
</footer>"""


def page(body: str, meta: dict, filename: str) -> str:
    title = meta["title"]
    desc = meta["description"]
    scripts = "".join(
        f'\n<script src="assets/js/{s}" defer></script>' for s in meta.get("scripts", "").split()
    )
    canonical = BASE_URL + ("" if filename == "index.html" else filename)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#070a10">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/geist-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/bricolage-grotesque-opsz.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/site.css">
<script src="assets/js/theme.js"></script>
<script src="assets/js/site.js" defer></script>{scripts}
</head>
<body class="sheet">
{header(meta.get("nav", "none"))}
<main id="main">
{body.strip()}
</main>
{FOOTER}
</body>
</html>
"""


META_RE = re.compile(r"^\s*<!--(.*?)-->", re.S)
INCLUDE_RE = re.compile(r"<!--#include ([a-z0-9-]+)-->")
BANNED = {"\u2014": "em dash", "\u2013": "en dash", "\u00b7": "middle dot"}


def main() -> int:
    built = []
    for src in sorted(SRC.glob("*.html")):
        text = src.read_text(encoding="utf-8")
        m = META_RE.match(text)
        if not m:
            print(f"{src.name}: missing header block", file=sys.stderr)
            return 1
        meta = {}
        for line in m.group(1).strip().splitlines():
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip()
        body = INCLUDE_RE.sub(lambda mm: (SRC / "partials" / f"{mm.group(1)}.html")
                              .read_text(encoding="utf-8"), text[m.end():])
        out = page(body, meta, src.name)
        for ch, name in BANNED.items():
            if ch in out:
                line_no = out[: out.index(ch)].count("\n") + 1
                print(f"{src.name}: contains an {name} (output line {line_no})", file=sys.stderr)
                return 1
        if src.name == "404.html":
            # GitHub Pages serves this file for a missing path at ANY depth, so
            # relative links would resolve against the wrong folder.
            out = re.sub(r'(href|src)="(?!https?:|#|/|mailto:)', r'\1="/ovat-navigate/', out)
        (ROOT / src.name).write_text(out, encoding="utf-8")
        built.append(src.name)
        print(f"built {src.name}")

    urls = "\n".join(
        f"  <url><loc>{BASE_URL}{'' if n == 'index.html' else n}</loc></url>"
        for n in built if n != "404.html"
    )
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n</urlset>\n", encoding="utf-8")
    print("built sitemap.xml")
    return 0


if __name__ == "__main__":
    sys.exit(main())
