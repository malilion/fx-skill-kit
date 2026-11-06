# PRD 03 implementation

All requested toolkit phases are implemented with pure ESM, Node built-ins, and no runtime npm packages.

| Deliverable | Implementation |
| --- | --- |
| Six quality gates | Guarded seed-42 replay/hash, 1.5% border spill with transition exemption, last-playback MSE and centroid seam vs adjacent ×1.5, invisible/overfilled/dead-head/tail checks, warmed 300-step 120Hz timing, configurable domain plugins |
| Scaffolding | category/name under src/fx, --loop/--sim, seeded palette-aware template, atomic catalog update |
| Visual review | Annotated contact PNG/JSON and every-frame 12fps act strip; negative windup, hit-stop, recovery, bounds and phase labels |
| Bakers | Exact transparent PNG atlas + JSON, zero-dependency GIF89a previews, nine-view tilt inspection, page-packed C header export |
| MCP | Four tools, stdio JSON-RPC lifecycle/discovery/calls, image content, errors and sequential requests; no SDK |
| Authoring guidance | Updated README, authoring contract, iron-rule skill and primitives/examples/baking references |

## Validation

Both examples passed strict CLI checks with the working ink-entropy domain plugin (non-loop seam is explicitly skipped for pulse-dot). Full machine-readable evidence is in [verification.json](../records/verification.json). Limits: p95 <1.5ms, max <3ms.

| Asset | p95 | max | Result |
| --- | --- | --- | --- |
| pulse-dot.js | 0.359ms | 0.419ms | PASS |
| orbit-loop.js | 0.054ms | 0.111ms | PASS |

Tests cover all six gates, scaffold/catalog behavior, fixed-120Hz Sim state across display rates, dense act timelines and phases, exact PNG atlas pixels, independent GIF decoding, palette/tilt propagation, C mask packing, all four MCP tools and JSON-RPC stream framing. A real stdio smoke session exercised initialization, discovery and all four tools. A generated C header passed cc C11 syntax checking. Functional tests skip incidental timing to avoid scheduler-related flakes; explicit budget tests cover strict thresholds and real slow-frame failures.

## Visual review

Round 1: inspected pulse contact F000–F030 and orbit act F000–F024. The pulse retains a soft fringe and distinct flecks through F024–F028, with a short blank endpoint. The orbit stays clear of the edge, preserves its origin and returns to its initial phase. Bounds and guides remain separate from export pixels.

Round 2: regenerated after removing per-pixel color-array allocation in the drawing primitive, then inspected pulse act F000–F012 and the zhusha orbit contact F000–F060. Fade and motion continuity remain intact; the palette changes pigment while preserving timing and silhouette. No visual source correction was needed.

Nine PNG/GIF review artifacts plus diagnostic JSON were copied to /workspace/fx-projects/shots/fx-skill-kit/.

## Format limits

GIF uses a 216-color palette, centisecond timing, transparency for empty pixels, and paper-composited partial alpha; literal LZW favors a small implementation over file size. PNG atlases preserve original RGBA. C export is an uncompressed 1-bit alpha mask, not the oledfx hardware compression pipeline. Catalog search ranks words locally without embeddings. MCP is local stdio only and executes trusted effect/config modules. See [MCP.md](MCP.md).
