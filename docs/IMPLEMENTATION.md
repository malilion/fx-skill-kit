# Master PRD Suite Implementation (PRD 01 `inkfx` · PRD 02 `oledfx` · PRD 03 `fx-skill-kit`)

All three sections of the Master PRD Suite (`docs/PRD.md`) are implemented in pure ESM with Node built-ins and zero runtime npm dependencies.

| PRD Section | Deliverable | Implementation |
| --- | --- | --- |
| **PRD 01 (`inkfx`)** | Dual-buffer ink engine (`src/core/ink.js`) | `InkFrame` (`pigment`, `wetness`, `tint`, `paperGrain`), dry-brush (`feibai`) `stampDryBrush`/`stampInkStroke`/`stampInkDrop`, wet diffusion + dark fringe (`stepInkDiffusion`), 6-stop non-linear mineral color ramps (`songyan`, `zhusha`, `shiqing`, `nijin`) |
| **PRD 01 (`inkfx`)** | Wuxia `act` & 6-category FX catalog (`16` effects in `src/fx/`) | `sword/sword-qi-slash`, `sword/cross-cleave`, `sword/myriad-swords`, `talisman/bagua-seal`, `talisman/cinnabar-burn`, `talisman/ink-chains`, `zen/bamboo-wind`, `zen/plum-blossom`, `zen/falling-sakura`, `ink-burst/heavy-impact`, `ink-burst/qi-surge`, `ink-burst/splash-guard`, `transitions/brush-sweep`, `transitions/ink-drop-wash`, `ui/vermilion-seal`, `ui/realm-breakthrough` |
| **PRD 01 (`inkfx`)** | Engine sprite sheet baker (`tools/export-sheet.mjs`) | Transparent or Xuan-paper (`--paper`) PNG + JSON Atlas with `meta.inkfx.act` hit-stop and frameTags |
| **PRD 02 (`oledfx`)** | 1-bit & RGB565 screen + Dithering (`src/core/oled.js`, `src/core/dither.js`) | Hardware profiles (`ssd1306-128x64`, `ssd1306-128x32`, `led-matrix-64x32`, `st7789-128x128`), `threshold` / `bayer4x4` (17-step ordered) / `checker` / `atkinson` dithering, parametric primitives (`fillRoundRect`, `fillCircle`, `arc`, `toFrame`), 16-bit `RGB565` (`packRgb565Frame`, `encodeRgb565XorRle`, `decodeRgb565XorRleStep`) |
| **PRD 02 (`oledfx`)** | Micro-screen FX catalog (`14` effects across all 5 categories in `src/fx/`) | `eyes/happy-squint`, `eyes/curious-blink`, `eyes/cyber-charge`, `eyes/dizzy-spiral`, `weather/rain-storm`, `weather/sunny-orbit`, `weather/snow-drift`, `system/wifi-pulse`, `system/battery-charge`, `system/cpu-wave`, `pomodoro/hot-coffee`, `pomodoro/hourglass-flip`, `transitions/crt-off`, `transitions/venetian-blinds` |
| **PRD 02 (`oledfx`)** | MCU compiler (`tools/export-mcu.mjs`) | 1-bit `XOR-Delta + RLE` compression (`< 3.7 KB`, ~90%+ compression) + zero-malloc C11 inline decoder `oledfx_step_frame`, 16-bit `RGB565` raw & RLE (`oledfx_step_rgb565`), plus `xbm` and `adafruit` bitmap modes |
| **PRD 03 (`fx-skill-kit`)** | Agentic feedback loop (`new`, `check`, `render`, `act`, `showcase`, `mcp-server`, `gallery`) | CHK-01..06 quality gates, annotated contact sheets & 12fps act strips, `6×4` simultaneous showcase grid GIF (`records/showcase-grid.gif`), 4-tool stdio MCP server, scrollable `IntersectionObserver` Gallery with Xuan-paper & SSD1306 dual-zone OLED simulator |

## Validation Summary (`records/verification.json`)

All **32** catalog effects (`2` Starter + `16` InkFX + `14` OLEDFX) pass strict CLI checks (`CHK-01` through `CHK-06`, `seed=42`, `p95 < 1.5ms`, `max < 3.0ms`), domain plugins (`inkfx/entropy`, `oledfx/shimmer` = `0.00%`, `oledfx/rle-budget` `< 4 KB`), and visual contact-sheet review.
