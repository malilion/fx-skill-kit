<p align="center"><a href="README.md">English</a> &nbsp;|&nbsp; <b>繁體中文</b></p>

<p align="center"><img src="docs/brand/icon-512.png" alt="fx-skill-kit" width="160" height="160"></p>

<h1 align="center">fx-skill-kit</h1>

<p align="center"><b>撰寫、檢查、渲染、修正確定性的程序化特效，人和 coding agent 都適用。</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript (ESM)">
  <img src="https://img.shields.io/badge/Node.js-20%2B-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 20+">
  <img src="https://img.shields.io/badge/MCP-stdio-000000?style=flat-square&logo=modelcontextprotocol&logoColor=white" alt="MCP">
  <img src="https://img.shields.io/badge/C-headers-A8B9CC?style=flat-square&logo=c&logoColor=black" alt="C headers">
  <img src="https://img.shields.io/badge/Arduino-PROGMEM-00878F?style=flat-square&logo=arduino&logoColor=white" alt="Arduino">
  <a href="https://malilion.github.io/fx-skill-kit/"><img src="https://img.shields.io/badge/GitHub_Pages-live-222222?style=flat-square&logo=githubpages&logoColor=white" alt="GitHub Pages"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-D22128?style=flat-square&logo=apache&logoColor=white" alt="License: Apache 2.0"></a>
</p>

<p align="center"><a href="https://malilion.github.io/fx-skill-kit/gallery/"><b>線上展示 ↗</b></a></p>

![展示牆](records/showcase-grid.gif)

**fx-skill-kit** 是零依賴的程序化特效工具組。用 JavaScript 寫一個小特效，跑六項確定性品質檢查（`CHK-01..06`），再渲染出一眼就能判斷好壞的接觸表（contact sheet）：**Draft → Check → Render → Look → Refine**。內附 32 個範例特效，涵蓋東方水墨／武俠視覺（InkFX）與 1-bit／RGB565 微型螢幕動畫（OLEDFX），並提供 stdio MCP 伺服器，讓 coding agent 也能走同一套流程。

## 安裝

需要 Node.js 20 以上。沒有 npm 依賴，也不需要 build。

```sh
git clone https://github.com/malilion/fx-skill-kit.git
cd fx-skill-kit
npm test
```

## 使用方式

```sh
npm run check -- sword/sword-qi-slash --seed 42             # 品質檢查
npm run render -- sword/sword-qi-slash --seed 42 --sheet --gif
npm run export-sheet -- sword/sword-qi-slash --palette zhusha --paper
npm run export-mcu -- eyes/curious-blink --profile ssd1306-128x64 --fps 24 --compress xor-rle
npm run gallery                                             # 開啟 http://127.0.0.1:8080/gallery/
```

建立自己的特效：

```sh
npm run new -- ui/my-pulse --loop --sim
npm run check -- ui/my-pulse --seed 42
npm run render -- ui/my-pulse --seed 42
```

- **export-sheet**：輸出透明或宣紙底的 sprite sheet 與 JSON atlas（Aseprite／Godot／Phaser）。
- **export-mcu**：輸出 C 標頭檔，支援 `ssd1306-128x64`、`ssd1306-128x32`、`led-matrix-64x32`、`st7789-128x128`，格式可選 `xor-rle`、`xbm`、`adafruit`。

### MCP 伺服器

執行 `npm run mcp`（stdio）。工具：`fx_search_catalog`、`fx_render_contact_sheet`、`fx_run_diagnostics`、`fx_export_asset`。用戶端設定見 [docs/MCP.md](docs/MCP.md)。

![水墨劍氣斬擊接觸表](records/sword/sword-qi-slash/contact.png)

特效規格請看 [docs/AUTHORING.md](docs/AUTHORING.md)，agent skill 請看 [skills/fx-authoring](skills/fx-authoring/SKILL.md)。

## 效果清單

| 領域 | 類別 | 數量 | 效果 ID |
| :--- | :--- | ---: | :--- |
| 入門 | `starter` | 2 | `pulse-dot`, `orbit-loop` |
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

32 個效果在 seed 42 下全部通過 `CHK-01..06`。

## 授權

Copyright 2026 Malilion。採用 [Apache License 2.0](LICENSE) 授權，詳見 [NOTICE](NOTICE)。
