import {
  createInkFrame,
  clearInkFrame,
  stampDryBrush,
  stampInkDrop,
  stampInkStroke,
  compositeInkFrame,
} from '../../core/ink.js';
import { mineralRamps } from '../../core/palette.js';
import { mulberry32 } from '../../core/seed.js';
import { viewPoint } from '../../core/view.js';

export const meta = {
  id: 'talisman/cinnabar-burn',
  name: 'Cinnabar Talisman Ignition',
  category: 'talisman',
  tags: ['inkfx', 'talisman', 'cinnabar', 'fire', 'seal'],
  duration: 1.4,
  loop: false,
  sim: true,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: mineralRamps.zhusha,
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

  const embers = Array.from({ length: 18 }, (_, i) => ({
    x0: (rand() - 0.5) * 38,
    y0: 28 - rand() * 52,
    drift: (rand() - 0.5) * 24,
    rise: 18 + rand() * 24,
    r: 1.8 + rand() * 1.9,
    tint: i % 2 === 0 ? 1 : 0,
  }));

  return {
    t: 0,
    step(dt) {
      this.t += dt;
    },
    draw(frame) {
      clearInkFrame(ink);
      const origin = viewPoint(0, 0, opts.tiltX, opts.tiltY, 8, 6);
      ink.ox = meta.ox + origin.x;
      ink.oy = meta.oy + origin.y;

      const u = Math.max(0, Math.min(1, this.t / meta.duration));
      const fade = Math.max(0.3, 1 - u * 0.62);
      const topY = -44;
      const botY = Math.max(topY + 20, 42 - u * 62);

      // Talisman paper slip outline above burn line
      stampInkStroke(ink, -22, topY, 22, topY, 2.4, 0.25, 0.88 * fade, 0);
      stampInkStroke(ink, -22, topY, -22, botY, 2.3, 0.28, 0.85 * fade, 0);
      stampInkStroke(ink, 22, topY, 22, botY, 2.3, 0.28, 0.85 * fade, 0);

      // Central cinnabar rune script
      stampInkStroke(ink, 0, topY + 8, 0, Math.max(topY + 16, botY - 4), 3.1, 0.2, 0.94 * fade, 1);
      stampInkStroke(ink, -13, topY + 18, 13, topY + 24, 2.5, 0.22, 0.9 * fade, 1);

      // Ignition line & rising embers
      for (let i = -4; i <= 4; i++) {
        stampInkDrop(ink, i * 5.2, botY + Math.sin(u * 10 + i) * 2, 2.8, 0.9, Math.abs(i) % 2 === 0 ? 1 : 0);
      }

      for (const e of embers) {
        const ex = Math.max(-54, Math.min(54, e.x0 + e.drift * u));
        const ey = Math.max(-54, Math.min(54, e.y0 - e.rise * u));
        stampDryBrush(ink, ex, ey, e.r, 0.22, 0.82 * fade, e.tint);
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
