import {
  createInkFrame,
  clearInkFrame,
  stampInkDrop,
  stampInkStroke,
  compositeInkFrame,
} from '../../core/ink.js';
import { mineralRamps } from '../../core/palette.js';
import { viewPoint } from '../../core/view.js';

export const meta = {
  id: 'ink-burst/splash-guard',
  name: 'Ink Splash Ward',
  category: 'ink-burst',
  tags: ['inkfx', 'wuxia', 'shield', 'splash', 'shiqing'],
  duration: 1.8,
  loop: true,
  sim: false,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: mineralRamps.shiqing,
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

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
      const breath = Math.cos(phase);
      const R = 36 + breath * 3.0;

      // 4 symmetric sweeping ink barrier arcs
      for (let q = 0; q < 4; q++) {
        const baseA = q * (Math.PI / 2) + Math.sin(phase) * 0.14;
        const a0 = baseA - 0.52;
        const a1 = baseA + 0.52;
        stampInkStroke(
          ink,
          Math.cos(a0) * R,
          Math.sin(a0) * R,
          Math.cos(a1) * R,
          Math.sin(a1) * R,
          3.8,
          0.24,
          0.9,
          q % 2 === 0 ? 1 : 0,
        );
      }

      // Inner protective seal nodes
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - breath * 0.18;
        const r = 19 - breath * 1.8;
        stampInkDrop(ink, Math.cos(a) * r, Math.sin(a) * r, 2.8, 0.88, i % 2 === 1 ? 1 : 0);
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
