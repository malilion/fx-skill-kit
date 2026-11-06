# Local MCP server

Start `node tools/mcp-server.mjs` with this repository as the working directory. The server uses only Node built-ins, accepts one JSON-RPC message per line on stdin, and writes only response messages on stdout. Logging goes to stderr. Protocol behavior follows the official [stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle), and [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) specifications. It is a small local implementation; it does not support HTTP, resources, prompts, streaming progress, or cancellation.

Example client configuration (replace the path with your checkout):

```json
{
  "mcpServers": {
    "fx-skill-kit": {
      "command": "node",
      "args": ["/absolute/path/fx-skill-kit/tools/mcp-server.mjs"],
      "cwd": "/absolute/path/fx-skill-kit"
    }
  }
}
```

For clients without a `cwd` setting, launch with a wrapper that changes to the checkout before invoking Node. No npm installation or SDK is needed. Print discovery schemas without starting a session using `node tools/mcp-server.mjs --schemas`.

The client first sends `initialize` with `protocolVersion`, `capabilities`, and `clientInfo`, then sends `notifications/initialized`. The server negotiates 2025-11-25, 2025-06-18, 2025-03-26, or 2024-11-05; an unsupported request receives the latest supported version for the client to accept or reject. It advertises the tools capability. `ping` works before initialization. EOF ends the process normally. Notifications receive no response. Malformed JSON, invalid requests/parameters, and unknown methods return JSON-RPC errors; failed tool execution returns `isError: true`.

| Tool | Arguments | Result |
| --- | --- | --- |
| `fx_search_catalog` | optional `query`, `category` strings | JSON text with ranked matching catalog entries; word matching, no embedding model or network service |
| `fx_render_contact_sheet` | `effect_id`, optional `palette` string or hex array | Base64 `image/png` block and JSON text with PNG/JSON paths and hash |
| `fx_run_diagnostics` | `effect_id` | JSON text with `pass`, hash, and CHK-01..06 details; failing diagnostics are a valid report |
| `fx_export_asset` | `effect_id`, `target_format`, optional `palette` | JSON text with export format and absolute file paths |

Export formats: `sheet` = transparent `sheet.png` + array atlas `sheet.json`; `gif` = `preview.gif`; `png` = annotated `contact.png`; `c-header` = `asset.h` containing uncompressed 1-bit alpha masks in SSD1306 vertical-page order. C export includes width, height, frame count, frame stride, and frame interval constants. A set bit means RGBA alpha >=128; RGB is ignored. C headers are portable C/C++ with optional Arduino PROGMEM support. Use oledfx's dedicated exporter for compressed hardware profiles and firmware integration.

All tools use seed 42 and write to `records/<id>/`. Palette and tilt options are passed to `create(opts)`; the effect must support them. MCP accepts catalog IDs rather than arbitrary module paths; catalog entries and `fx.config.js` are trusted executable code, not sandboxed data. Requests execute sequentially so diagnostics guards and artifact writes cannot overlap within a session.

Example wire messages, one per line:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"local-review","version":"1"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"fx_render_contact_sheet","arguments":{"effect_id":"orbit-loop","palette":"zhusha"}}}
```
