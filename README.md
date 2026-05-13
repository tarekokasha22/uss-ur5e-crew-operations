# USS UR5e — Crew Operations

**Browser-based ship operations simulation** for the GIU Robotics Lab *Information Retrieval / narrative UI* coursework: a day–night loop aboard the USS **UR5e**, pixel-style canvas rendering, 14 crew + UR5e-01, dossiers, mission log, comms feed, achievements, and scripted **☕ chill time** social sequences in the mess hall.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stack](https://img.shields.io/badge/stack-HTML5%20%2B%20Vanilla%20JS-orange)](https://developer.mozilla.org/docs/Web/HTML)
[![No build](https://img.shields.io/badge/build-none-success)](README.md)

## Highlights

| Area | Details |
|------|---------|
| **Simulation** | Mission day counter, ship clock, day/night cycle, HUD, toasts, ticker |
| **Crew** | 14 characters + robot; dossiers, portraits, home rooms, ambient chatter |
| **☕ Chill time** | Invited mess break, TA lab rules, per-room crowd caps, pruned scripted convos |
| **Dialogue** | Large script corpus in `js/chatter.js`; speaker-matched lines; shuffle-deck rotation to reduce repetition |
| **Persistence** | `localStorage` saves (progress, achievements) via `js/save.js` |
| **Audio** | Optional hooks in `js/audio.js` |

## Quick start

No install or bundler required — any static file server works.

```bash
git clone https://github.com/tarekokasha22/uss-ur5e-crew-operations.git
cd uss-ur5e-crew-operations
python3 -m http.server 8765
```

Open **http://localhost:8765** (use another port if busy, e.g. `8877`).

**Alternative** (if you use Node):

```bash
npx --yes serve -l 8765
```

## GitHub Pages (optional)

1. Repository → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch `main` / folder `/ (root)`.
2. After the workflow or build completes, the site is served from `https://<user>.github.io/<repo>/`.

For a **project site** at `username.github.io/repo-name/`, ensure asset paths are relative (this project uses relative `href`/`src` paths).

## Repository layout

| Path | Role |
|------|------|
| `index.html` | Main shell, HUD, game mount |
| `dossiers.html` | Secondary dossier flow |
| `style.css` | Global layout and UI |
| `js/game.js` | Game loop, boot, input, rendering orchestration |
| `js/pixel.js` | Canvas drawing — ship, rooms, characters, effects |
| `js/ai.js` | Crew AI, chill time, rooms, exchanges, caps |
| `js/chatter.js` | Missions, chill convo scripts, variety decks |
| `js/crew.js` | Crew definitions (bios, lines, rooms) |
| `js/rooms.js` | Room metadata |
| `js/hud.js` | Log, comms feed, modals, toasts |
| `js/save.js` | Persistence |
| `js/audio.js` | Audio helpers |

## Tech stack

- **HTML5**, **CSS3**, **JavaScript** (ES5-compatible style) — no framework
- **Canvas 2D** playfield
- **localStorage** for saves

## Contributing

Issues and pull requests are welcome. Keep diffs focused and match existing style (plain functions, minimal dependencies).

## License

[MIT License](LICENSE) — Copyright (c) 2026 USS UR5e / IR Project contributors.

## Acknowledgements

**GIU Robotics Lab** — Information Retrieval–themed narrative UI around collaborative robotics and ship operations.
