# fx-skill-kit · inkfx · oledfx

<p align="center"><img src="docs/brand/icon-512.png" alt="fx-skill-kit mark — contact sheet + agent loop" width="160" height="160"></p>

<p align="center">
  <strong>🇬🇧 English</strong> ·
  <a href="README.zh-TW.md">🇹🇼 繁體中文</a> ·
  <a href="https://malilion.github.io/fx-skill-kit/gallery/">🌐 Live GitHub Pages Gallery</a> ·
  <a href="docs/IMPLEMENTATION.md">📐 Implementation Report</a> ·
  <a href="docs/AUTHORING.md">✍️ Authoring Contract</a> ·
  <a href="docs/MCP.md">🔌 MCP Protocol</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License: Apache 2.0"></a>
</p>


---

**Zero-dependency procedural FX suite: Eastern Wuxia ink engine (`inkfx`), 1-bit & RGB565 MCU compiler (`oledfx`), six deterministic quality gates (`CHK-01..06`), contact-sheet visual review, and four stdio MCP tools (`fx-skill-kit`).**

![6x4 Simultaneous Showcase Grid](records/showcase-grid.gif)

![Sword Qi Slash preview](records/sword/sword-qi-slash/preview.gif) ![Curious Blink preview](records/eyes/curious-blink/preview.gif) ![Orbit loop preview](records/orbit-loop/preview.gif)

For procedural-asset developers, game creators, embedded makers, and coding-agent authors working with deterministic effects. Draft a tiny JavaScript effect, check its behavior, and render a contact sheet you can actually judge. `fx-skill-kit` gives humans and coding agents the exact same loop: **Draft → Check → Render → Look → Refine**.

---

## 🌐 Live Interactive Gallery (GitHub Pages)

- **Flagship Dual-Realm Atelier**: **[https://malilion.github.io/fx-skill-kit/gallery/](https://malilion.github.io/fx-skill-kit/gallery/)** *(Repository kept `Private`; static ESM bundle deployed via GitHub Actions Pages)*
- **5-Act Editorial & Studio Architecture (with Paginated Views)**:
  1. **`01 STAGE` · Split-Realm Interactive Stage**: Live Xuan-paper dry-brush (`feibai`) + wet diffusion canvas on the left, paired with a skeuomorphic `128×64` SSD1306 I²C PCB breakout module whose robot eyes track your cursor and resonate with cross-realm slashes.
  2. **`02 ANATOMY` · Physics & Algorithm Deconstruction Theater**: Real-time 4-layer InkFX buffer decomposition (`01 Pigment`, `02 Wetness`, `03 Paper Grain`, `04 Composite`) + 6-stop non-linear mineral ramps (`清·淡·重·濃·焦·點綴`), alongside 4-way 1-bit dithering (`Bayer 4×4`, `Checker`, `Atkinson`, `XOR-Delta Frame[t] ^ Frame[t-1]` heatmap) and ESP32 Flash budget gauge.
  3. **`03 ARCHIVE (32)` · Paginated 32-Effect Live Exhibition Wall**: `IntersectionObserver` 60fps live canvas archive with **13 category filter pills**, `⌘K` instant search, and **pagination controls** (`8 / 12 / ALL (32)` per page + `← PREV / 01 / 02 / 03 / NEXT →`).
  4. **`04 STUDIO` · Interactive Workbench & Hardware Simulator**: Switch between Xuan-paper scroll mount and SSD1306 cyan / white / dual-zone (`上16px黃 + 下48px藍`) hardware shells, inspect the 4-phase Wuxia `act` timeline (`WINDUP · ACTIVE · FREEZE · RECOVERY`) and live 120Hz step-budget sparkline, copy single-file JS / React / Vue components, or download PNG / Raw `.h` / `XOR-RLE` C11 headers.
  5. **`05 MCP LOOP` · Agentic Feedback Loop & CLI Terminal**: Interactive reference for `CHK-01..06` gates and one-click copyable CLI / MCP commands.
- **Navigation & Bilingual Tabs**: Switch between **All 5 Acts (`ALL 全覽`)** or **Paginated Single-Chapter Tabs (`01 STAGE`–`05 MCP LOOP`)**, toggle **Xuan Ink (`宣紙 INK`)** vs **Silicon Darkroom (`晶格 OLED`)** atmosphere, and switch typography between **`中/EN`**, **`繁中`**, and **`EN`**.

---

## 📦 32-Effect Catalog Breakdown

The catalog contains **32 deterministic effects** across starter RGBA (`2`), **InkFX** (`16` effects across all 6 Eastern ink & Wuxia categories), and **OLEDFX** (`14` effects across all 5 embedded micro-screen categories):

| Domain | Category | Count | Bundled Effect IDs |
| :--- | :--- | ---: | :--- |
| **Starter** | `starter` | 2 | `pulse-dot`, `orbit-loop` |
| **InkFX** | `sword` | 3 | `sword/sword-qi-slash`, `sword/cross-cleave`, `sword/myriad-swords` |
| **InkFX** | `talisman` | 3 | `talisman/bagua-seal`, `talisman/cinnabar-burn`, `talisman/ink-chains` |
| **InkFX** | `zen` | 3 | `zen/bamboo-wind`, `zen/plum-blossom`, `zen/falling-sakura` |
| **InkFX** | `ink-burst` | 3 | `ink-burst/heavy-impact`, `ink-burst/qi-surge`, `ink-burst/splash-guard` |
| **InkFX** | `transitions` | 2 | `transitions/brush-sweep`, `transitions/ink-drop-wash` |
| **InkFX** | `ui` | 2 | `ui/vermilion-seal`, `ui/realm-breakthrough` |
| **OLEDFX** | `eyes` | 4 | `eyes/happy-squint`, `eyes/curious-blink`, `eyes/cyber-charge`, `eyes/dizzy-spiral` |
| **OLEDFX** | `weather` | 3 | `weather/rain-storm`, `weather/sunny-orbit`, `weather/snow-drift` |
| **OLEDFX** | `system` | 3 | `system/wifi-pulse`, `system/battery-charge`, `system/cpu-wave` |
| **OLEDFX** | `pomodoro` | 2 | `pomodoro/hot-coffee`, `pomodoro/hourglass-flip` |
| **OLEDFX** | `transitions` | 2 | `transitions/crt-off`, `transitions/venetian-blinds` |
| **Total** | **11 Categories** | **32** | **100% Pass on `CHK-01..06` (Seed 42)** |

---

## 🚀 Quick Start & CLI Pipeline

Requires Node.js 20 or newer. Zero external npm dependencies; no install or build step required.

```sh
npm test
npm run check
npm run check -- sword/sword-qi-slash eyes/curious-blink --seed 42
npm run render -- sword/sword-qi-slash --seed 42 --sheet --gif
npm run act -- sword/sword-qi-slash --seed 42
npm run export-sheet -- sword/sword-qi-slash --palette zhusha --paper
npm run export-mcu -- eyes/curious-blink --profile ssd1306-128x64 --fps 24 --compress xor-rle
npm run export-mcu -- sword/sword-qi-slash --profile st7789-128x128 --fps 15 --compress xor-rle
npm run showcase

npm run gallery
# Open http://127.0.0.1:8080/gallery/
```

Scaffold your own effect, then check and inspect its contact sheet:

```sh
npm run new -- ui/my-pulse --loop --sim
npm run check -- ui/my-pulse --seed 42
npm run render -- ui/my-pulse --seed 42
npm run act -- ui/my-pulse --seed 42
```

- **InkFX Sprite Sheet Baker (`tools/export-sheet.mjs`)**: Exports transparent (`sheet.png`) or textured Xuan-paper (`--paper`, `sheet-paper.png`) sprite sheets and Aseprite / Godot / Phaser compatible JSON atlases with `meta.inkfx.act` hit-stop timelines and 6-stop mineral palettes (`songyan`, `zhusha`, `shiqing`, `nijin`).
- **OLEDFX Hardware Compiler (`tools/export-mcu.mjs`)**: Compiles animations into ESP32 / Arduino C11 headers across hardware profiles (`ssd1306-128x64`, `ssd1306-128x32`, `led-matrix-64x32`, `st7789-128x128`). Supports `--compress xor-rle` (`~93%` size reduction, `< 3.6 KB` for 1-bit OLED, with zero-malloc `oledfx_step_frame` and 16-bit `oledfx_step_rgb565_frame` C decoders), `--compress xbm`, and `--compress adafruit`.

---

## 🔌 Stdio MCP Server (`tools/mcp-server.mjs`)

Start the stdio MCP server with `npm run mcp` (or configure your agent client to launch `node tools/mcp-server.mjs`):

| Tool | Result |
| :--- | :--- |
| `fx_search_catalog(query?, category?)` | Ranked local keyword search across all 32 IDs, tags, and metadata |
| `fx_render_contact_sheet(effect_id, palette?)` | Base64 PNG contact sheet image block plus artifact paths |
| `fx_run_diagnostics(effect_id)` | Structured `CHK-01..06` report (`seed=42`) |
| `fx_export_asset(effect_id, target_format, palette?)` | `sheet`, `gif`, `png`, or `c-header` artifact paths |

---

## 🖼️ Contact Sheet Visual Inspection

**Sword Qi Slash (`sword/sword-qi-slash`):** Wuxia draw-cut slash with negative windup (`-0.12s`), cinnabar eye glint, dry-brush (`feibai`) arc, hit-stop freeze (`0.08s`), and flung ink droplets.

![Sword Qi Slash contact sheet](records/sword/sword-qi-slash/contact.png)

**Curious Blink (`eyes/curious-blink`):** `128×64` 1-bit parametric robot eyes with gaze tracking and blink, compressing from `49,152 Bytes` raw to `3,333 Bytes` (`93.2%` saved) via `export-mcu.mjs`.

![Curious Blink contact sheet](records/eyes/curious-blink/contact.png)

See [AUTHORING.md](docs/AUTHORING.md) for the metadata, RGBA buffer, seed, and check contracts. Coding agents can follow [the FX authoring skill](skills/fx-authoring/SKILL.md) to keep visual inspection in the loop.

---

## License

Copyright 2026 Malilion.

Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE) for attribution.

