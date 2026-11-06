# fx-skill-kit

**Give procedural FX a visible feedback loop.**

Draft a tiny JavaScript effect, check its behavior, and render a contact sheet you can actually judge. fx-skill-kit gives humans and coding agents the same loop: **Draft → Check → Render → Look → Refine**.

It catches unseeded randomness and clocks, edge spill, broken loop seams, dead frames, and slow drawing. Optional domain plugins add project-specific checks. Every contact-sheet cell shows a frame number, elapsed seconds, fill percentage, safe-area guide, and origin crosshair. The JSON beside it keeps full-precision timings and frame statistics.

## Try it

Requires Node.js 20 or newer. No package installation or build step.

```sh
npm test
npm run check
npm run render
npm run act
# Open records/pulse-dot/contact.png and records/orbit-loop/act-strip.png
```

Create your own effect, then check and inspect it:

```sh
npm run new -- ui/my-pulse --loop --sim
npm run check -- ui/my-pulse --seed 42
npm run render -- ui/my-pulse --seed 42
npm run act -- ui/my-pulse --seed 42
```

Scaffolding updates `src/catalog.json`; tools accept catalog IDs or JS paths. `act` writes every 12fps sample to `records/<id>/act-strip.png` and JSON, including negative windup and recovery when `act` metadata is present. `render --out examples/out/<id>` still supports the earlier layout.

Checks use seed 42 by default. Edge occupancy must stay below 1.5% (transitions are exempt); loop seams use median adjacent-frame MSE × 1.5 with an absolute fallback. Dead tails must stay within 15%, with peak fill between 0.2% and 85%. After warmup, 300 steps at 120Hz must have p95 < 1.5ms and max < 3ms. Use `--perf-soft` for a warning or `FX_CHECK_PERF=0` to skip timing in unstable CI. Copy `fx.config.example.js` to `fx.config.js` to register domain checks.

## What you see

**Pulse dot:** a soft, seeded ink pulse that blooms and fades.

![Pulse dot contact sheet with frame indices, seconds, fill ratios, safe areas, and origin crosshairs](records/pulse-dot/contact.png)

**Orbit loop:** a particle and fading trail returning to their starting phase.

![Orbit loop contact sheet showing matching start and end frames](records/orbit-loop/contact.png)

Read each sheet left to right, top to bottom. The crosshair anchors the effect's origin; fill% describes the effect before annotations. First and last cells include both timeline endpoints. Add `--frames 31` to inspect more moments or `--out path/to/review` to choose the output directory.

## Preview in motion

```sh
node gallery/serve.mjs
# Open http://127.0.0.1:8080/gallery/
```

The static gallery loads the same ES modules onto a canvas, with seed selection, replay, pause, and origin guides. Any local static server rooted at this repo also works. No build step or hosted deployment is needed.

See [AUTHORING.md](docs/AUTHORING.md) for the metadata, RGBA buffer, seed, and check contracts. Agents can follow [the FX authoring skill](skills/fx-authoring/SKILL.md) to keep visual inspection in the loop.

Private project. Core tools use pure ESM and Node built-ins, with zero runtime dependencies.
