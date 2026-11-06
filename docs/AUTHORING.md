# Authoring FX

An FX is a pure ESM file exporting `meta` and `create(opts)`. The same module runs in the Node tools and the local browser gallery. Core code has no runtime dependencies.

```js
export const meta = {
  id: 'my-pulse', duration: 1, loop: false,
  w: 160, h: 160, ox: 80, oy: 80,
};
export function create({ seed = 1 } = {}) {
  return {
    t: 0,
    step(dt) { this.t += dt; },
    draw(frame) { /* Write RGBA pixels into frame. */ },
  };
}
```

## Metadata and lifecycle

| Field | Contract |
| --- | --- |
| `id` | Unique lowercase kebab-case ID or category/name, such as `orbit-loop` or `sword/draw-slash`. |
| `duration` | Finite positive duration in seconds. |
| `loop` | Boolean. True requires the image at `duration` to match the image at zero. |
| `w`, `h` | Integer frame dimensions, at least 2 pixels each. |
| `ox`, `oy` | Finite origin coordinates in frame pixels: `0 <= ox < w`, `0 <= oy < h`. |

`create({seed})` returns a fresh, independent instance with `t=0`. `step(dt)` advances simulation time by exactly `dt` seconds; it must not depend on wall-clock time. Methods are called on the returned object, so `this.t` is available. `draw(frame)` renders the current state, without advancing time or consuming random numbers. Allocate seed-derived constants and particle properties in `create`, rather than in module globals or `draw`.

The tools take `ceil(duration * fps)` equal steps of `dt = duration / ceil(duration * fps)` and include both endpoints. At the default 30 fps, a one-second effect has 31 samples. Durations that do not align with 30 Hz use a slightly smaller, still constant dt, so the final sample is exactly at the declared duration. The gallery uses the same scheme with a 60 Hz target. Design animation against elapsed seconds, not frame counts. Non-looping effects hold at their duration; looping effects restart from the same seed.

## RGBA frame

```js
{ w, h, ox, oy, data: new Uint8ClampedArray(w * h * 4) }
```

Pixels are row-major, from the top left. Offset `(y * w + x) * 4` stores red, green, blue, alpha, in that order; channels range from 0 through 255. Alpha is straight (unpremultiplied), with zero fully transparent. Keep RGB zero where alpha is zero for stable buffer comparison. Draw using frame dimensions/origin so callers can supply the metadata consistently.

The runner clears the entire buffer to transparent before each `draw`; render a complete frame rather than relying on pixels from the previous frame. Helpers in `src/core/frame.js`:

- `createFrame(w, h, ox?, oy?)` allocates a transparent buffer.
- `clear(frame)` zeros every channel.
- `setPixel(frame, x, y, [r,g,b,a=255])` clips coordinates and composites source over destination.
- `fillCircle(frame, cx, cy, radius, color, softness=0)` draws a circle with pixel-center coverage; softness in `[0,1]` controls the fade width.

Use a plain RGBA buffer directly if preferred. The helpers and seed PRNG are browser-compatible. The PNG writer and sampling/checking code use Node built-ins.

## Seeds and determinism

Use `mulberry32(seed)` from `src/core/seed.js`, or an equivalent local seeded PRNG. Seeds are unsigned 32-bit integers; seed zero is valid. `check` defaults to 42; rendering, the gallery, and module defaults remain 1. Pass the same explicit seed to check and render for matching evidence. Never call `Math.random`, `Date.now`, or `performance.now`, including at module initialization. Avoid clocks, external state, unseeded noise, and shared mutable module state. Identical seed and sampling options must produce identical frame bytes on repeated runs.

```sh
npm run new -- ui/my-pulse --loop --sim
npm run check -- ui/my-pulse --seed 42
npm run render -- ui/my-pulse --seed 42
npm run act -- ui/my-pulse --seed 42
```

`new <category/name>` writes `examples/fx/<category/name>.js`; flat IDs still work. `--loop` creates a periodic envelope, and `--sim` creates a fixed-step simulation state updated in `step`. Both flags can be combined. `--out fx` chooses another base directory and computes relative helper imports. Scaffolding creates or updates `src/catalog.json` (`{schemaVersion:1,effects:[{id,file,category,loop,sim}]}`); `--catalog path` selects a separate index. Paths in the catalog are relative to the working directory. Existing files and duplicate catalog IDs are refused. Check, render, and act accept either catalog IDs or JS paths. Copy the helper files too when moving a module to another project, or inline the small helpers.

## Checks and contact sheets

`check` defaults to both examples. It exits nonzero on any required failure:

- **CHK-01** blocks `Math.random`, `Date.now`, and `performance.now` during module import, creation, stepping, and drawing, restoring them even on failure. It imports the entry module afresh twice with seed 42 by default and compares SHA-256 of every sampled RGBA buffer in order. Dependency modules remain in the ESM cache, so they must also avoid shared mutable state. The guard is a development check, not an isolation sandbox.
- **CHK-02** counts pixels with alpha > 0 on the outermost one-pixel ring, counting corners once. Every frame in both runs must have ring occupancy strictly below `--edge-threshold` (default `0.015`, or 1.5%). IDs or path segments matching `transitions/`, or `meta.category === 'transitions'`, are exempt. The ratio is a fraction of ring pixels, not of the entire image.
- **CHK-03** compares the first and terminal frames of each run if `meta.loop=true`. RGBA byte MSE must be <= `max(1.5 × median adjacent-frame MSE, --seam-threshold)`. The absolute fallback defaults to `0.5` squared byte units, allowing tiny quantization differences in static or nearly static loops. Non-loops print SKIP. Visually review adjacent frames too.
- **CHK-04** requires peak fill across the active timeline to be between `0.002` (0.2%) and `0.85` (85%), inclusive. Trailing blank frames (fill <= `0.000001`) must occupy <= 15% of the declared duration. Blank duration is trailing frame count × sample dt, capped at duration; a single blank endpoint is allowed at normal sampling rates. Negative windup is excluded from these checks.
- **CHK-05** warms up for 360 steps, then measures 300 `step(1/120)` + clear + draw calls. It replays the declared lifetime so a long dead tail cannot hide expensive drawing. The required limits are p95 < 1.5ms and max < 3.0ms. `--perf-soft` prints WARN for budget overruns while other checks still fail normally; `FX_CHECK_PERF=0` prints SKIP for CI environments with unstable timing. Runtime exceptions still fail.
- **CHK-06** loads optional `fx.config.js` from the working directory (`--config path` overrides it). Named `domainChecks` or a default export containing `domainChecks` registers an array of `{id, run(ctx)}`. Each sync/async hook returns a boolean or `{pass:boolean, detail?, skip?}`. Context contains `file`, `fx`, `meta`, `seed`, `fps`, `frames`, `run`, and both deterministic `runs`. Missing config or an empty list prints SKIP; exceptions, malformed hooks, or failing results fail CHK-06. Copy `fx.config.example.js` for a no-op plus explicitly skipped ink entropy and OLED shimmer stubs.

`render` uses the same sampler and defaults to 16 evenly selected samples, always including both endpoints. Use `--frames 31 --columns 4` for all samples of a one-second effect at 30 Hz. Fewer samples are used when the timeline is shorter than the requested count. `--fps`, `--seed`, and `--out directory` are supported; with multiple inputs, `--out` contains numbered subdirectories in input order. Otherwise each result lives under `records/<id>/`. Explicit `--out examples/out/<id>` remains supported.

Each contact cell has its actual frame index, `t=0.000s` timestamp (rounded to milliseconds), fill percentage, a faint safe-area border inset 8% of the shorter dimension, and an origin crosshair. The timestamp is elapsed time, never normalized progress. The footer labels `OX` and `OY`. Fill counts original pixels with alpha > 0; paper, borders, labels, and crosshairs are excluded. The safe-area inset is a visual guide; CHK-02 measures the actual one-pixel outer ring.

`contact.json` preserves full-precision sample times, all per-frame fill/edge ratios, `fillPercent`, the complete run hash, dt, metadata, timeline endpoints, and the selected contact cell indices. Checks analyze every simulated frame even when the sheet displays only a subset.

## Dense action inspection

`npm run act -- <id-or-file> --seed 42` writes `records/<id>/act-strip.png` and `act-strip.json`. It renders **every** sample at fixed 12fps, wrapped into six columns (`--columns` changes the wrap), with the same origin, time, and fill overlays. No `act` metadata is required: ordinary effects still get a dense strip. Both endpoints are included; only the final step may be shorter than 1/12 second to land exactly on an off-grid endpoint. `--out` works like render.

Export `act` or set `meta.act` to describe `{windup, poses, hits, recovery}`. `windup` and `recovery` are nonnegative seconds. The render/act timeline starts at `-windup` and ends at the latest of `meta.duration`, pose timestamps, or `hit.t + hit.freeze`, plus `recovery`. The renderer initializes the fresh instance's `t` to the negative start and steps forward; author its draw/simulation to handle negative time and recovery beyond duration. `poses` and `hits` are retained in JSON for inspection. Author hit-stop behavior in the FX itself; the inspector does not add another freeze or pose rig. Regular contact rendering also includes this timeline, while checks sample 0 through duration so windup cannot dilute dead-tail ratios.

See the skill's [primitives quick reference](../skills/fx-authoring/references/primitives.md) and [example guide](../skills/fx-authoring/references/examples.md).

Follow the required [authoring skill](../skills/fx-authoring/SKILL.md): Draft → Check → Render → Look → Refine. Repeat after every visual edit until both checks and visual review are satisfactory.
