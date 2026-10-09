# OVAT Navigate

A visual guide to [OVAT](https://github.com/Lagmator22/ovat), the OpenVINO
Agentic Toolkit: one YAML file and one command give you a tool-calling AI agent
on your own Intel AI PC.

Live at **https://lagmator22.github.io/ovat-navigate/**

| Page | What it covers |
| --- | --- |
| [Overview](https://lagmator22.github.io/ovat-navigate/) | What OVAT is, the request flow, the four engines, headline results |
| [Architecture](https://lagmator22.github.io/ovat-navigate/architecture.html) | The nine layers, with animated diagrams of the loop, RAG, telemetry and device routing |
| [Guide](https://lagmator22.github.io/ovat-navigate/guide.html) | Install, serve, run, chat, bench, the terminal UI, workflow.yml, MCP tools |
| [Results](https://lagmator22.github.io/ovat-navigate/results.html) | Measurements from an Intel LunarLake AI PC |
| [Codebase](https://lagmator22.github.io/ovat-navigate/codebase.html) | A clickable map of every module in the `ovat` package |

Every fact on the site comes from the OVAT source code and its design notes
(`docs/ARCHITECTURE.md`, `AGENTS.md`) at version 1.1.1.

## How it is built

Plain HTML, CSS and JavaScript. No framework, no CDN, no analytics, nothing
loaded from another origin.

```
src/*.html          page bodies, each with a small header block
src/partials/       pieces shared by more than one page
build.py            wraps every page in the shared header, footer and CSP
assets/css/site.css the whole design system, as tokens at the top
assets/js/          theme, diagrams (flow.js), terminal replay, codebase map
assets/fonts/       self-hosted fonts and their licenses
```

Edit a file in `src/`, then run:

```bash
python3 build.py
```

The generated `*.html` files in the root are committed, so GitHub Pages serves
them as they are. The build refuses to write a page that contains an em dash,
an en dash or a middle dot.

To preview locally, serve the folder with any static server, for example
`python3 -m http.server`, and open `http://localhost:8000/`.

## Diagrams

Every diagram is hand-drawn inline SVG. `assets/js/flow.js` moves a signal
along the SVG paths and highlights nodes; the drawing is complete without it.
Animation runs only while a diagram is on screen, every autoplaying piece has
a pause control, and `prefers-reduced-motion` turns travelling motion off while
keeping the step-by-step controls.

## Fonts

Self-hosted under the SIL Open Font License 1.1 (license files in
`assets/fonts/`): Bricolage Grotesque, Geist and Intel One Mono.

## License

Apache 2.0, like OVAT itself. Intel and OpenVINO are trademarks of Intel
Corporation; this is not an official Intel or OpenVINO site.
