# fx-skill-kit

**Zero-dependency procedural FX authoring: six quality checks, visual review, sprite/GIF export, and four MCP tools.**

![Orbit loop preview](records/orbit-loop/preview.gif)

Draft a tiny JavaScript effect, check its behavior, and render a contact sheet you can actually judge. fx-skill-kit gives humans and coding agents the same loop: **Draft → Check → Render → Look → Refine**.

It catches unseeded randomness and clocks, edge spill, broken loop seams, dead frames, and slow drawing. Optional domain plugins add project-specific checks. Every contact-sheet cell shows a frame number, elapsed seconds, fill percentage, safe-area guide, and origin crosshair. The JSON beside it keeps full-precision timings and frame statistics.

## Try it

Requires Node.js 20 or newer. No package installation or build step.

```sh
npm test
npm run check
npm run render -- --sheet --gif
npm run act
# Open records/pulse-dot/contact.png and records/orbit-loop/act-strip.png
```

Create your own effect, then check and inspect it:

```sh
npm run new -- ui/my-pulse --loop --sim
npm run check -- ui/my-pulse --seed 42
npm run render -- ui/my-pulse --seed 42
npm run act -- ui/my-pulse --seed 42
```

Scaffolding writes `src/fx/<category/name>.js` and updates `src/catalog.json`; tools accept catalog IDs or JS paths. `act` writes every 12fps sample to `records/<id>/act-strip.png` and JSON, including negative windup and recovery when `act` metadata is present. `render --out examples/out/<id>` still supports the earlier layout.

Export every playback frame with `npm run render -- orbit-loop --sheet --gif --seed 42`. `sheet.png` is transparent and free of annotations; `sheet.json` is an array atlas with frame rectangles, millisecond durations, origin, seed, loop, and act metadata. `preview.gif` is a dependency-free animated GIF with a 216-color palette and transparency. GIF uses centisecond timing and literal LZW, so it favors simplicity over small files; partial alpha is composited against paper. Loops omit the duplicate endpoint. `--palette zhusha` (or a JSON array of hex colors) is forwarded to the FX, and `--multi-angle` renders nine `(tiltX, tiltY)` views for modules that implement these inputs.

Start the stdio MCP server in this repo with `npm run mcp` (configure clients to launch `node tools/mcp-server.mjs` directly). It exposes:

| Tool | Result |
| --- | --- |
| `fx_search_catalog(query?, category?)` | Ranked local keyword search across IDs, tags, and metadata |
| `fx_render_contact_sheet(effect_id, palette?)` | PNG image block plus artifact paths |
| `fx_run_diagnostics(effect_id)` | Structured CHK-01..06 report, seed 42 |
| `fx_export_asset(effect_id, target_format, palette?)` | `sheet`, `gif`, `png`, or `c-header` artifact paths |

See [MCP setup and protocol](docs/MCP.md). No MCP SDK or npm packages are required. C headers contain uncompressed SSD1306-style vertical pages from the alpha mask; the dedicated oledfx exporter owns its hardware-specific compression pipeline.

Checks use seed 42 by default. Edge occupancy must stay below 1.5% (transitions are exempt); loop seams compare `t=0` against `duration − 1/fps`, requiring MSE and centroid movement within median adjacent change × 1.5. Blank active heads and tails must each stay within 15%; effects must become visible (0.2% fill) and must not remain over 85% filled throughout. After warmup, 300 steps at 120Hz must have p95 < 1.5ms and max < 3ms. Use `--perf-soft` for a warning or `FX_CHECK_PERF=0` to skip timing in unstable CI. Use `check --json` for machine-readable reports. Copy `fx.config.example.js` to `fx.config.js` to register domain checks; reusable ink-density entropy, isolated OLED shimmer, and XOR-RLE size checks are included.

## What you see

**Pulse dot:** a soft, seeded ink pulse that blooms and fades.

![Pulse dot contact sheet with frame indices, seconds, fill ratios, safe areas, and origin crosshairs](records/pulse-dot/contact.png)

**Orbit loop:** a particle and fading trail returning to their starting phase.

![Orbit loop contact sheet showing matching start and end frames](records/orbit-loop/contact.png)

Read each sheet left to right, top to bottom. The crosshair anchors the effect's origin; fill% describes the effect before annotations. First and last cells include both timeline endpoints. Add `--frames 31` to inspect more moments or `--out path/to/review` to choose the output directory.

## Preview in motion

```sh
node gallery/serve.mjs
# Open http://127.0.0.1:8080/gallery/
```

The static gallery loads the same ES modules onto a canvas, with seed selection, replay, pause, and origin guides. Any local static server rooted at this repo also works. No build step or hosted deployment is needed.

See [AUTHORING.md](docs/AUTHORING.md) for the metadata, RGBA buffer, seed, and check contracts. Agents can follow [the FX authoring skill](skills/fx-authoring/SKILL.md) to keep visual inspection in the loop.

Private project. Core tools use pure ESM and Node built-ins, with zero runtime dependencies.
