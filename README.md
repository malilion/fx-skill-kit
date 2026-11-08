# fx-skill-kit · inkfx · oledfx

<p align="center"><img src="docs/brand/icon-512.png" alt="fx-skill-kit mark — contact sheet + agent loop" width="160" height="160"></p>

**English** · [繁體中文](README.zh-TW.md)

**Zero-dependency procedural FX suite: Wuxia ink engine (`inkfx`), 1-bit & RGB565 MCU compiler (`oledfx`), six quality checks, contact-sheet visual review, and four MCP tools (`fx-skill-kit`).**

![6x4 Simultaneous Showcase Grid](records/showcase-grid.gif)

![Sword Qi Slash preview](records/sword/sword-qi-slash/preview.gif) ![Curious Blink preview](records/eyes/curious-blink/preview.gif) ![Orbit loop preview](records/orbit-loop/preview.gif)

For procedural-asset developers, game creators, embedded makers, and coding-agent authors working with deterministic effects. Draft a tiny JavaScript effect, check its behavior, and render a contact sheet you can actually judge. `fx-skill-kit` gives humans and coding agents the same loop: **Draft → Check → Render → Look → Refine**.

The catalog contains **32 effects** across starter RGBA, **InkFX** (`16` effects with `Pigment + Wetness` dual-buffer Eastern ink washes & Wuxia `act` combat timing across all 6 categories), and **OLEDFX** (`14` effects with `128×64` 1-bit & `RGB565` micro-screen animations, ordered Bayer 4×4 dithering, and `XOR-Delta + RLE` ESP32 C header compilation across all 5 categories):

| Catalog category | Effects |
| --- | ---: |
| Starter (`orbit-loop`, `pulse-dot`) | 2 |
| InkFX (`sword/*` ×3, `talisman/*` ×3, `zen/*` ×3, `ink-burst/*` ×3, `transitions/*` ×2, `ui/*` ×2) | 16 |
| OLEDFX (`eyes/*` ×4, `weather/*` ×3, `system/*` ×3, `pomodoro/*` ×2, `transitions/*` ×2) | 14 |
| **Total** | **32** |

## Try it

Requires Node.js 20 or newer. No package installation or build step.

```sh
npm test
npm run check
npm run check -- sword/sword-qi-slash eyes/curious-blink --seed 42
npm run render -- sword/sword-qi-slash --seed 42 --sheet --gif
npm run act -- sword/sword-qi-slash --seed 42
npm run export-sheet -- sword/sword-qi-slash --palette zhusha --paper
npm run export-mcu -- eyes/curious-blink --profile ssd1306-128x64 --fps 24 --compress xor-rle

npm run gallery
# Open http://127.0.0.1:8080/gallery/
```

Create your own effect, then check and inspect it:

```sh
npm run new -- ui/my-pulse --loop --sim
npm run check -- ui/my-pulse --seed 42
npm run render -- ui/my-pulse --seed 42
npm run act -- ui/my-pulse --seed 42
```

Scaffolding writes `src/fx/<category/name>.js` and updates `src/catalog.json`; tools accept catalog IDs or JS paths. `act` writes every 12fps sample to `records/<id>/act-strip.png` and JSON, including negative windup and recovery when `act` metadata is present.

- **InkFX Sprite Sheet Baker (`tools/export-sheet.mjs`)**: Exports transparent (`sheet.png`) or textured Xuan-paper (`--paper`, `sheet-paper.png`) sprite sheets and Aseprite / Godot / Phaser compatible JSON atlases with `meta.inkfx.act` hit-stop timelines and mineral palettes (`songyan`, `zhusha`, `shiqing`, `nijin`).
- **OLEDFX Hardware Compiler (`tools/export-mcu.mjs`)**: Compiles animations into ESP32 / Arduino C headers across hardware profiles (`ssd1306-128x64`, `ssd1306-128x32`, `led-matrix-64x32`, `st7789-128x128`). `--compress xor-rle` packs SSD1306 vertical pages with `XOR-Delta + RLE` compression (`~90%+` size reduction, `< 3.5 KB`) and embeds the zero-malloc `oledfx_step_frame` C decoder; `--compress xbm` and `--compress adafruit` emit standard bitmap arrays.

Start the stdio MCP server in this repo with `npm run mcp` (configure clients to launch `node tools/mcp-server.mjs` directly):

| Tool | Result |
| --- | --- |
| `fx_search_catalog(query?, category?)` | Ranked local keyword search across IDs, tags, and metadata |
| `fx_render_contact_sheet(effect_id, palette?)` | PNG image block plus artifact paths |
| `fx_run_diagnostics(effect_id)` | Structured CHK-01..06 report, seed 42 |
| `fx_export_asset(effect_id, target_format, palette?)` | `sheet`, `gif`, `png`, or `c-header` artifact paths |

See [MCP setup and protocol](docs/MCP.md) and [Implementation summary](docs/IMPLEMENTATION.md).

## What you see

**Sword Qi Slash (`sword/sword-qi-slash`):** Wuxia draw-cut slash with negative windup, cinnabar eye glint, dry-brush (`feibai`) arc, hit-stop freeze, and flung ink droplets.

![Sword Qi Slash contact sheet](records/sword/sword-qi-slash/contact.png)

**Curious Blink (`eyes/curious-blink`):** `128×64` 1-bit parametric robot eyes with gaze tracking and blink, compressing from 48 KB raw to 2.8 KB via `export-mcu.mjs`.

![Curious Blink contact sheet](records/eyes/curious-blink/contact.png)

## Preview in motion

The gallery (`npm run gallery`) includes an `IntersectionObserver` live scrollable wall of all 14 effects, mineral palette switching (`songyan`, `zhusha`, `shiqing`, `nijin`), paper grain roughness control, Wuxia `act` dummy overlay, `0.25x` slow-motion, SSD1306 OLED phosphor & dual-zone (`上16px黃 + 下48px藍`) hardware simulation, single-file JS / React / Vue code copy, and PNG / XOR-RLE C header downloads.

See [AUTHORING.md](docs/AUTHORING.md) for the metadata, RGBA buffer, seed, and check contracts. Agents can follow [the FX authoring skill](skills/fx-authoring/SKILL.md) to keep visual inspection in the loop.
