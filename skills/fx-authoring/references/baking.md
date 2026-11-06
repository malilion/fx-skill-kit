# Baking and tool clients

Use the CLI from the repository root:

```sh
node tools/check.mjs orbit-loop --seed 42 --json
node tools/render.mjs orbit-loop --seed 42 --sheet --gif
node tools/act.mjs orbit-loop --seed 42
```

Inspect contact.png for composition and act-strip.png for timing. sheet.png contains exact RGBA animation frames without inspection guides; sheet.json provides rectangles and millisecond timings. GIF uses a 216-color preview palette with transparent empty pixels; partial alpha is composited against paper. Deliver PNG atlases for exact color and transparency. Loops omit the duplicate terminal frame in baked playback assets.

For alternate colors pass `--palette zhusha` or a JSON hex array; FX must accept `create({palette})`. For tilt-dependent effects, `--multi-angle` samples nine tiltX/tiltY combinations at the midpoint. Contact JSON retains exact times even when displayed labels round them.

MCP clients can launch `node tools/mcp-server.mjs` to search the catalog, render an image block, run diagnostics, and export assets. Consult [the protocol and setup guide](../../../docs/MCP.md) for arguments and client configuration. C header export is an uncompressed 1-bit alpha mask; use the domain-specific oledfx pipeline for compression and firmware profiles.
