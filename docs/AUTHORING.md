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
| `id` | Unique lowercase kebab-case identifier, such as `orbit-loop`. |
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

Use `mulberry32(seed)` from `src/core/seed.js`, or an equivalent local seeded PRNG. Seeds are unsigned 32-bit integers, defaulting to 1; seed zero is valid. Never call `Math.random`, including at module initialization. Avoid clocks, external state, unseeded noise, and shared mutable module state. Identical seed and sampling options must produce identical frame bytes on repeated runs.

```sh
npm run new -- my-pulse
npm run check -- examples/fx/my-pulse.js --seed 7
npm run render -- examples/fx/my-pulse.js --seed 7
```

`new --out fx/category` supports another directory inside this repo and computes relative helper imports. It refuses to overwrite an existing FX. Copy the helper files too when moving a module to another project, or inline the small helpers.

## Checks and contact sheets

`check` defaults to both examples. It exits nonzero on any required failure:

- **CHK-01** blocks `Math.random` during module import, creation, stepping, and drawing; it imports the entry module afresh twice and compares SHA-256 of every sampled RGBA buffer in order. Dependency modules remain in the ESM cache, so they must also avoid shared mutable state. The guard is a development check, not an isolation sandbox.
- **CHK-02** counts pixels with alpha > 0 on the outermost one-pixel ring, counting corners once. Every frame in both runs must have ring occupancy strictly below `--edge-threshold` (default `0.005`, or 0.5%). This is a fraction of ring pixels, not of the entire image.
- **CHK-03** compares the first and terminal frames of each run if `meta.loop=true`. The mean squared error across all RGBA byte channels must be <= `--seam-threshold` (default `0.5`, in squared byte units; the maximum possible MSE is 65025). Non-loops print SKIP. A low seam MSE alone cannot prove good motion: visually review adjacent frames too.

CHK-04 blank/overexposed frames, CHK-05 performance, and CHK-06 domain plugins are reserved, not enforced in Phase 1.

`render` uses the same sampler and defaults to 16 evenly selected samples, always including both endpoints. Use `--frames 31 --columns 4` for all samples of a one-second effect at 30 Hz. Fewer samples are used when the timeline is shorter than the requested count. `--fps`, `--seed`, and `--out directory` are supported; with multiple inputs, `--out` contains numbered subdirectories in input order. Otherwise each result lives under `examples/out/<id>/`.

Each contact cell has its actual frame index, `t=0.000s` timestamp (rounded to milliseconds), fill percentage, a faint safe-area border inset 8% of the shorter dimension, and an origin crosshair. The timestamp is elapsed time, never normalized progress. The footer labels `OX` and `OY`. Fill counts original pixels with alpha > 0; paper, borders, labels, and crosshairs are excluded. The safe-area inset is a visual guide; CHK-02 measures the actual one-pixel outer ring.

`contact.json` preserves full-precision sample times, all per-frame fill/edge ratios, `fillPercent`, the complete run hash, fixed dt, metadata, and the selected contact cell indices. Checks analyze every simulated frame even when the sheet displays only a subset.

Follow the required [authoring skill](../skills/fx-authoring/SKILL.md): Draft → Check → Render → Look → Refine. Repeat after every visual edit until both checks and visual review are satisfactory.
