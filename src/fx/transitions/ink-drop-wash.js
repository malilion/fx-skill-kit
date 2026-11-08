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
  id: 'transitions/ink-drop-wash',
  name: 'Ink Drop Ripple Wash',
  category: 'transitions',
  tags: ['inkfx', 'transition', 'wash', 'ripple', 'shiqing'],
  duration: 1.5,
  loop: false,
  sim: true,
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
      const origin = viewPoint(0, 0, opts.tiltX, opts.tiltY, 6, 6);
      ink.ox = meta.ox + origin.x;
      ink.oy = meta.oy + origin.y;

      const u = Math.max(0, Math.min(1, this.t / meta.duration));
      const maxR = 14 + Math.sin(u * Math.PI * 0.85) * 62;
      const fade = Math.max(0.3, 1 - Math.max(0, u - 0.72) * 1.6);

      // Central ink drop core
      stampInkDrop(ink, 0, 0, 9 + u * 12, 0.9 * fade, 0);

      // Radial wet ink wash spokes
      const spokes = 14;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2 + u * 0.35;
        const r0 = 8 + u * 10;
        const r1 = maxR * (0.84 + 0.16 * Math.sin(i * 2.3));
        stampInkStroke(
          ink,
          Math.cos(a) * r0,
          Math.sin(a) * r0,
          Math.cos(a) * r1,
          Math.sin(a) * r1,
          4.6 + u * 2.5,
          0.2,
          0.86 * fade,
          i % 4 === 0 ? 1 : 0,
        );
      }

      // Outer dark fringe ring
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        stampInkDrop(ink, Math.cos(a) * maxR, Math.sin(a) * maxR, 3.8, 0.84 * fade, i % 3 === 0 ? 1 : 0);
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
