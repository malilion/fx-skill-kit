<p align="center"><b>English</b> &nbsp;|&nbsp; <a href="README.zh-TW.md">繁體中文</a></p>

<p align="center"><img src="docs/brand/icon-512.png" alt="fx-skill-kit" width="160" height="160"></p>

<h1 align="center">fx-skill-kit</h1>

<p align="center"><b>Draft, check, render, and refine deterministic procedural FX — for people and coding agents.</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript (ESM)">
  <img src="https://img.shields.io/badge/Node.js-20%2B-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 20+">
  <img src="https://img.shields.io/badge/MCP-stdio-000000?style=flat-square&logo=modelcontextprotocol&logoColor=white" alt="MCP">
  <img src="https://img.shields.io/badge/C-headers-A8B9CC?style=flat-square&logo=c&logoColor=black" alt="C headers">
  <img src="https://img.shields.io/badge/Arduino-PROGMEM-00878F?style=flat-square&logo=arduino&logoColor=white" alt="Arduino">
  <a href="https://malilion.github.io/fx-skill-kit/"><img src="https://img.shields.io/badge/GitHub_Pages-live-222222?style=flat-square&logo=githubpages&logoColor=white" alt="GitHub Pages"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-D22128?style=flat-square&logo=apache&logoColor=white" alt="License: Apache 2.0"></a>
</p>

<p align="center"><a href="https://malilion.github.io/fx-skill-kit/gallery/"><b>Live gallery ↗</b></a></p>

![Showcase grid](records/showcase-grid.gif)

**fx-skill-kit** is a zero-dependency toolkit for procedural effects. Write a small JavaScript effect, run six deterministic quality checks (`CHK-01..06`), and render a contact sheet you can judge at a glance: **Draft → Check → Render → Look → Refine**. It ships with 32 sample effects covering Eastern ink / Wuxia visuals (InkFX) and 1-bit / RGB565 micro-screen animation (OLEDFX), plus a stdio MCP server so coding agents can use the same loop.

## Installation

Requires Node.js 20+. There are no npm dependencies and no build step.

```sh
git clone https://github.com/malilion/fx-skill-kit.git
cd fx-skill-kit
npm test
```

## Usage

```sh
npm run check -- sword/sword-qi-slash --seed 42             # quality checks
npm run render -- sword/sword-qi-slash --seed 42 --sheet --gif
npm run export-sheet -- sword/sword-qi-slash --palette zhusha --paper
npm run export-mcu -- eyes/curious-blink --profile ssd1306-128x64 --fps 24 --compress xor-rle
npm run gallery                                             # open http://127.0.0.1:8080/gallery/
```

Create your own effect:

```sh
npm run new -- ui/my-pulse --loop --sim
npm run check -- ui/my-pulse --seed 42
npm run render -- ui/my-pulse --seed 42
```

- **export-sheet**: transparent or Xuan-paper sprite sheets with JSON atlases (Aseprite / Godot / Phaser).
- **export-mcu**: C headers for `ssd1306-128x64`, `ssd1306-128x32`, `led-matrix-64x32`, `st7789-128x128`, with `xor-rle`, `xbm`, or `adafruit` output.

### MCP server

Run `npm run mcp` (stdio). Tools: `fx_search_catalog`, `fx_render_contact_sheet`, `fx_run_diagnostics`, `fx_export_asset`. See [docs/MCP.md](docs/MCP.md) for client setup.

![Sword Qi Slash contact sheet](records/sword/sword-qi-slash/contact.png)

See [docs/AUTHORING.md](docs/AUTHORING.md) for the effect contract and [skills/fx-authoring](skills/fx-authoring/SKILL.md) for the agent skill.

## Effects

| Domain | Category | Count | Effect IDs |
| :--- | :--- | ---: | :--- |
| Starter | `starter` | 2 | `pulse-dot`, `orbit-loop` |
| InkFX | `sword` | 3 | `sword/sword-qi-slash`, `sword/cross-cleave`, `sword/myriad-swords` |
| InkFX | `talisman` | 3 | `talisman/bagua-seal`, `talisman/cinnabar-burn`, `talisman/ink-chains` |
| InkFX | `zen` | 3 | `zen/bamboo-wind`, `zen/plum-blossom`, `zen/falling-sakura` |
| InkFX | `ink-burst` | 3 | `ink-burst/heavy-impact`, `ink-burst/qi-surge`, `ink-burst/splash-guard` |
| InkFX | `transitions` | 2 | `transitions/brush-sweep`, `transitions/ink-drop-wash` |
| InkFX | `ui` | 2 | `ui/vermilion-seal`, `ui/realm-breakthrough` |
| OLEDFX | `eyes` | 4 | `eyes/happy-squint`, `eyes/curious-blink`, `eyes/cyber-charge`, `eyes/dizzy-spiral` |
| OLEDFX | `weather` | 3 | `weather/rain-storm`, `weather/sunny-orbit`, `weather/snow-drift` |
| OLEDFX | `system` | 3 | `system/wifi-pulse`, `system/battery-charge`, `system/cpu-wave` |
| OLEDFX | `pomodoro` | 2 | `pomodoro/hot-coffee`, `pomodoro/hourglass-flip` |
| OLEDFX | `transitions` | 2 | `transitions/crt-off`, `transitions/venetian-blinds` |

All 32 effects pass `CHK-01..06` at seed 42.

## License

Copyright 2026 Malilion. Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE).
