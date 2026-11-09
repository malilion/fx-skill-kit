# Example FX

## Starter (`examples/fx/`)
- [pulse-dot.js](../../../examples/fx/pulse-dot.js): a one-second non-looping bloom (`records/pulse-dot/contact.png`).
- [orbit-loop.js](../../../examples/fx/orbit-loop.js): a two-second periodic orbit (`records/orbit-loop/contact.png`).

## InkFX · 東方水墨與武俠特效 (`src/fx/`)
- [sword/sword-qi-slash.js](../../../src/fx/sword/sword-qi-slash.js): Wuxia draw-cut slash with negative windup (`-0.40s`), cinnabar eye glint, dry-brush (`feibai`) arc, hit-stop freeze (`0.15s`), and flung ink droplets.
- [sword/cross-cleave.js](../../../src/fx/sword/cross-cleave.js): Twin intersecting slashes with cinnabar burst core and wet diffusion.
- [talisman/bagua-seal.js](../../../src/fx/talisman/bagua-seal.js): Looping Bagua trigram seal with `nijin` gold and vermilion accents.
- [zen/bamboo-wind.js](../../../src/fx/zen/bamboo-wind.js): Calligraphic bamboo stalk and drifting leaves in a seamless loop.
- [ink-burst/heavy-impact.js](../../../src/fx/ink-burst/heavy-impact.js): Radial shockwave ring with water-stain dark fringe (`水痕`) and ink splatters.
- [transitions/brush-sweep.js](../../../src/fx/transitions/brush-sweep.js): Broad multi-bristle brush transition (exempt from CHK-02 edge-spill).
- [ui/vermilion-seal.js](../../../src/fx/ui/vermilion-seal.js): Traditional carved vermilion stamp (`朱印`) with stone grain texture.

## OLEDFX · 嵌入式微螢幕動畫 (`src/fx/`)
- [eyes/happy-squint.js](../../../src/fx/eyes/happy-squint.js): `128×64` parametric rounded-rect robot eyes with `lookX/lookY` gaze tracking and crescent smile carve-out.
- [eyes/curious-blink.js](../../../src/fx/eyes/curious-blink.js): `128×64` curious asymmetric squint and blink, compressing to `< 3 KB` via `export-mcu.mjs`.
- [weather/rain-storm.js](../../../src/fx/weather/rain-storm.js): Storm cloud with Bayer 4×4 under-shadow, falling rain streaks, and splash ripples.
- [system/wifi-pulse.js](../../../src/fx/system/wifi-pulse.js): Concentric Wi-Fi signal arcs and SSD1306 top-zone status indicator.
- [pomodoro/hot-coffee.js](../../../src/fx/pomodoro/hot-coffee.js): Crisp `threshold` mug paired with rising `bayer4x4` dithered steam plumes.

```sh
npm run check -- sword/sword-qi-slash eyes/curious-blink --seed 42
npm run render -- sword/sword-qi-slash eyes/curious-blink --seed 42
npm run act -- sword/sword-qi-slash --seed 42
```
