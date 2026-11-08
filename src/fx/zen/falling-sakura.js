import {
  createInkFrame,
  clearInkFrame,
  stampInkStroke,
  compositeInkFrame,
} from '../../core/ink.js';
import { mineralRamps } from '../../core/palette.js';
import { viewPoint } from '../../core/view.js';

export const meta = {
  id: 'zen/falling-sakura',
  name: 'Drifting Sakura Petals',
  category: 'zen',
  tags: ['inkfx', 'zen', 'sakura', 'petals', 'loop'],
  duration: 2.0,
  loop: true,
  sim: false,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: mineralRamps.zhusha,
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

  const petals = [
    { cx: -28, cy: -6, rx: 9, ry: 5, off: 0.0, tint: 1 },
    { cx: 28, cy: 6, rx: -9, ry: -5, off: 0.0, tint: 1 },
    { cx: -6, cy: 22, rx: 7, ry: -6, off: 1.57, tint: 1 },
    { cx: 6, cy: -22, rx: -7, ry: 6, off: 1.57, tint: 0 },
    { cx: -34, cy: 32, rx: 6, ry: 4, off: 3.14, tint: 1 },
    { cx: 34, cy: -32, rx: -6, ry: -4, off: 3.14, tint: 1 },
    { cx: -16, cy: -34, rx: 5, ry: -4, off: 4.71, tint: 1 },
    { cx: 16, cy: 34, rx: -5, ry: 4, off: 4.71, tint: 0 },
  ];

  return {
    t: 0,
    step(dt) {
      this.t += dt;
    },
    draw(frame) {
      clearInkFrame(ink);
      const origin = viewPoint(0, 0, opts.tiltX, opts.tiltY, 8, 8);
      ink.ox = meta.ox + origin.x;
      ink.oy = meta.oy + origin.y;

      const u = (((this.t % meta.duration) + meta.duration) % meta.duration) / meta.duration;
      const phase = u * Math.PI * 2;
      const gust = Math.cos(phase);

      // Symmetrical overhanging canopy twigs
      stampInkStroke(ink, -46, -42, -8 + gust * 2, -26 - gust, 3.2, 0.28, 0.88, 0);
      stampInkStroke(ink, 46, 42, 8 - gust * 2, 26 + gust, 3.2, 0.28, 0.88, 0);

      for (const p of petals) {
        const a = phase + p.off;
        const px = p.cx + Math.cos(a) * p.rx;
        const py = p.cy + Math.sin(a) * p.ry;
        const dx = Math.cos(a) * 4.0;
        const dy = Math.sin(a) * 2.5;
        stampInkStroke(ink, px - dx, py - dy, px + dx, py + dy, 2.7, 0.2, 0.9, p.tint);
      }

      compositeInkFrame(ink, frame, {
        palette: opts.palette,
        defaultPalette: meta.defaultPalette,
        paperBackground: Boolean(opts.paperBackground),
        grainRoughness: opts.grainRoughness ?? 1.0,
      });
    },
  };
}
