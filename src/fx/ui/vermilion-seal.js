import { mulberry32, hash2d } from '../../core/seed.js';
import {
  createInkFrame,
  clearInkFrame,
  stampDryBrush,
  stampInkStroke,
  stampInkDrop,
  compositeInkFrame,
} from '../../core/ink.js';
import { viewPoint } from '../../core/view.js';

export const meta = {
  id: 'ui/vermilion-seal',
  category: 'ui',
  duration: 0.9,
  loop: false,
  sim: false,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: ['#f4efe6', '#dfb8b0', '#a85249', '#8a2424', '#63201b', '#c83228'],
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

  const flecks = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + (rand() - 0.5) * 0.2;
    return {
      dx: Math.cos(a) * (34 + rand() * 16),
      dy: Math.sin(a) * (34 + rand() * 16),
      r: 1.4 + rand() * 1.8,
      gold: i % 3 === 0,
    };
  });

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

      const p = Math.min(1, (this.t + 0.03) / meta.duration);
      const impact = Math.min(1, p / 0.14);
      const fade = p > 0.78 ? Math.max(0.15, 1 - (p - 0.78) / 0.26) : 1;
      const half = Math.round(28 * (1.25 - 0.25 * impact));

      // Carved outer square border of traditional vermilion seal (朱印)
      stampInkStroke(ink, -half, -half, half, -half, 3.2, 0.22, 0.95 * fade, 1);
      stampInkStroke(ink, half, -half, half, half, 3.2, 0.22, 0.95 * fade, 1);
      stampInkStroke(ink, half, half, -half, half, 3.2, 0.22, 0.95 * fade, 1);
      stampInkStroke(ink, -half, half, -half, -half, 3.2, 0.22, 0.95 * fade, 1);

      // Stylized seal script glyph strokes inside the stamp
      stampInkStroke(ink, -16, -14, 16, -14, 2.6, 0.18, 0.92 * fade, 1);
      stampInkStroke(ink, 0, -18, 0, 18, 2.8, 0.16, 0.94 * fade, 1);
      stampInkStroke(ink, -14, 2, 14, 2, 2.5, 0.2, 0.9 * fade, 1);
      stampInkStroke(ink, -15, 15, 15, 15, 2.6, 0.22, 0.92 * fade, 1);

      // Aged stone seal texture inside the square
      for (let y = -half + 5; y <= half - 5; y += 6) {
        for (let x = -half + 5; x <= half - 5; x += 6) {
          if (hash2d(x + 50, y + 50, seed) > 0.55) {
            stampDryBrush(ink, x, y, 2.2, 0.35, 0.65 * fade, 1);
          }
        }
      }

      // Impact cinnabar & gold flecks around seal perimeter
      if (p >= 0.08) {
        const fleckP = Math.min(1, (p - 0.08) / 0.55);
        const fleckAlpha = (1 - fleckP * 0.65) * fade;
        for (const f of flecks) {
          const dist = 0.7 + 0.3 * fleckP;
          stampInkDrop(ink, f.dx * dist, f.dy * dist, f.r, fleckAlpha, f.gold ? 2 : 1);
        }
      }

      compositeInkFrame(ink, frame, { palette: opts.palette, defaultPalette: meta.defaultPalette });
    },
  };
}
