---
name: fx-authoring
description: Create or refine deterministic procedural FX in fx-skill-kit using its RGBA contract, automated checks, and contact-sheet visual review. Use for FX module authoring rather than general image generation.
---

# FX authoring loop

Read [the authoring contract](../../docs/AUTHORING.md) before changing an FX. Use repo-root commands. Keep the tools dependency-free, use seeded randomness, and keep content clear of the outermost pixel ring.

Follow **Draft → Check → Render → Look → Refine** for every new effect and visual change. Passing checks alone does not complete the task.

1. **Draft.** Scaffold with `npm run new -- <category/name> [--loop] [--sim]` or edit an existing module. Export the required metadata and a fresh `create({seed})` instance. Define intended timing, origin, silhouette, and whether the animation loops. Generate random parameters in `create`; drawing must not mutate simulation state.
2. **Check.** Run `npm run check -- <id> --seed 42`. Fix every required CHK-01..06 failure before proceeding. Preserve the animation's intended behavior rather than loosening thresholds to hide defects. CHK-06 runs when a domain config is present.
3. **Render.** Run `npm run render -- <id> --seed 42`. Keep sampling and seed consistent with the check. Read `contact.json` for precise times and stats when needed.
4. **Look.** Open and inspect the actual `records/<id>/contact.png` with an available image viewer. Read left to right, top to bottom. Compare the first and final cells for loops, and adjacent cells for unexpected jumps. Check silhouette, ink softness, motion rhythm, clipping, and readability at the intended size. Do not infer visual quality only from hashes or statistics. If no image viewer is available, report that visual inspection is incomplete.
5. **Refine.** Change the FX to address concrete issues observed in the sheet, then repeat Check → Render → Look. Complete at least two visual review rounds; record specific frame numbers and any resulting corrections. Re-render after corrections and inspect the final result. Finish only with current passing checks and an inspected sheet from the final FX source.

## Artistic and engineering iron rules

- Never deliver a visual change without passing checks and personally opening its contact sheet. Keep seed 42 fixed while comparing iterations; do not loosen thresholds to conceal failures.
- Burst effects should establish their main silhouette within the first 15% of active time, then spend the remaining time dissipating. Use anticipation, a fast impact, an authored hit-stop, and recovery rather than constant-speed motion. Inspect every 12fps act-strip frame when timing is uncertain.
- Preserve negative space: ink needs tonal layers, soft fringes, or dry-brush strands around its dense core; 1-bit OLED shapes and dithering must remain separated and legible.
- Keep the origin aligned with the source of motion or impact. Keep non-transition content off the outer pixel ring and design loops against the last playback frame, not just the exact duration endpoint.
- Use fresh seeded instances, simulation time, and state-free drawing. Never use Math.random or wall/performance clocks. Keep 120Hz p95 <1.5ms and max <3ms; configure domain checks for the target medium.

## Reading a contact sheet

- **Frame index** identifies the simulation tick. Cells may skip ticks; inspect the JSON `sheet.selected` list before interpreting a gap as a motion jump. Increase `--frames` for short bursts.
- **Time** is elapsed seconds, including zero and the declared duration. Labels round to milliseconds; JSON retains full precision. Use it to judge anticipation, impact, and decay rather than assuming each cell is one display frame.
- **Crosshair / OX / OY** mark the declared local origin. Watch for unintended drift or off-center expansion. The crosshair is an overlay, not FX content.
- **Safe-area border** is a faint 8% inset guide. Leave breathing room for soft fringes; CHK-02 independently tests the outermost ring.
- **Fill%** counts nontransparent FX pixels before overlays. Sudden spikes can reveal oversized radii or accidental full-frame fills; unexpectedly low values can reveal a missing draw. Compare cells and seeds; more fill is not inherently better.

For seeded variations, repeat with another explicit seed and inspect that sheet too when randomness materially changes the silhouette. Report the final source path, check result, seed, and rendered sheet path. Do not claim unimplemented checks passed.

Use `npm run act -- <id> --seed 42` for a complete 12fps strip, including negative windup when present. Consult [primitives](references/primitives.md) and [examples](references/examples.md) for working patterns.

For game/README delivery use `npm run render -- <id> --seed 42 --sheet --gif`. The sprite atlas preserves alpha; GIF is a quantized preview. Read [baking and MCP](references/baking.md) when choosing export formats or using tool clients.
