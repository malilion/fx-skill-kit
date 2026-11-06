# Example FX

- [pulse-dot.js](../../../examples/fx/pulse-dot.js): a one-second non-looping bloom. Seeded fleck properties are created once; a sine envelope fades the circles to a short blank endpoint. Review [the contact sheet](../../../records/pulse-dot/contact.png) and [12fps action strip](../../../records/pulse-dot/act-strip.png).
- [orbit-loop.js](../../../examples/fx/orbit-loop.js): a two-second periodic orbit. A seed-derived phase offsets a soft particle trail; start and terminal frames match. Review [the contact sheet](../../../records/orbit-loop/contact.png) and [12fps action strip](../../../records/orbit-loop/act-strip.png).

From the repository root:

```sh
npm run check -- pulse-dot orbit-loop --seed 42
npm run render -- pulse-dot orbit-loop --seed 42
npm run act -- pulse-dot orbit-loop --seed 42
```

Catalog IDs resolve through `src/catalog.json`; explicit `examples/fx/pulse-dot.js` paths work too. Inspect the PNGs after changing an effect, then repeat Draft → Check → Render → Look → Refine.
