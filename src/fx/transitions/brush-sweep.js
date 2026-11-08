import { mulberry32 } from '../../core/seed.js';
import {
  createInkFrame,
  clearInkFrame,
  stampDryBrush,
  compositeInkFrame,
} from '../../core/ink.js';

export const meta = {
  id: 'transitions/brush-sweep',
  category: 'transitions',
  duration: 0.9,
  loop: false,
  sim: false,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: ['#f4efe6', '#c9c2b8', '#7d766d', '#3b3734', '#161412', '#b82921'],
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

  const bristles = [
    { yOffset: -42, radius: 13.5, speed: 1.05, delay: 0.0,  tint: 0 },
    { yOffset: -14, radius: 15.5, speed: 1.0,  delay: 0.06, tint: 0 },
    { yOffset:  16, radius: 15.0, speed: 0.96, delay: 0.12, tint: 1 },
    { yOffset:  44, radius: 13.5, speed: 1.02, delay: 0.18, tint: 0 },
  ].map(b => ({ ...b, wobble: (rand() - 0.5) * 9 }));

  return {
    t: 0,
    step(dt) {
      this.t += dt;
    },
    draw(frame) {
      clearInkFrame(ink);
      const p = Math.min(1, (this.t + 0.03) / meta.duration);
      const fade = p > 0.72 ? Math.max(0.18, 1 - (p - 0.72) / 0.34) : 1;

      for (const b of bristles) {
        const localP = Math.max(0, Math.min(1, (p - b.delay) * 1.35 * b.speed));
        if (localP <= 0) continue;
        const steps = Math.max(4, Math.floor(22 * localP));
        for (let i = 0; i <= steps; i++) {
          const u = i / 22;
          const x = -70 + u * 140;
          const y = b.yOffset + Math.sin(u * Math.PI * 1.4) * b.wobble;
          const dry = 0.14 + u * 0.52 + (1 - fade) * 0.22;
          stampDryBrush(ink, x, y, b.radius * (0.78 + 0.22 * fade), dry, 0.92 * fade, b.tint);
        }
      }

      compositeInkFrame(ink, frame, { palette: opts.palette, defaultPalette: meta.defaultPalette });
    },
  };
}
