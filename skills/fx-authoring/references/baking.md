# Baking and tool clients

Use the CLI from the repository root:

```sh
node tools/check.mjs orbit-loop --seed 42 --json
node tools/render.mjs orbit-loop --seed 42 --sheet --gif
node tools/act.mjs sword/sword-qi-slash --seed 42
node tools/export-sheet.mjs sword/sword-qi-slash --palette zhusha --paper
node tools/export-mcu.mjs eyes/curious-blink --profile ssd1306-128x64 --fps 24 --compress xor-rle
```

Inspect `contact.png` for composition and `act-strip.png` for timing. `sheet.png` contains exact RGBA animation frames without inspection guides; `sheet.json` provides rectangles, millisecond timings, and `meta.inkfx.act` metadata. `export-sheet.mjs --paper` composites frames onto textured Xuan paper (`sheet-paper.png`).

For hardware targets, `export-mcu.mjs` compiles any animation into an ESP32 / Arduino C header (`--compress xor-rle`, `xbm`, `adafruit`, or `raw`). `xor-rle` packs SSD1306 vertical pages, encodes Frame 0 as a keyframe and Frame `1..N` as XOR deltas with 128-byte repeat/literal packets, and embeds the zero-malloc `oledfx_step_frame(uint8_t *fb, uint16_t frame_idx)` decoder.

MCP clients can launch `node tools/mcp-server.mjs` to search the catalog, render an image block, run diagnostics, and export assets. Consult [the protocol and setup guide](../../../docs/MCP.md) for arguments and client configuration.
