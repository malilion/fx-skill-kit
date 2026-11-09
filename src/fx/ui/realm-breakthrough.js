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
  id: 'ui/realm-breakthrough',
  name: 'Realm Breakthrough Halo',
  category: 'ui',
  tags: ['inkfx', 'ui', 'breakthrough', 'gold', 'nijin'],
  duration: 1.5,
  loop: false,
  sim: true,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: mineralRamps.nijin,
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

      const u = Math.max(0, Math.min(1, this.t / meta.duration));
      const ease = 1 - Math.pow(1 - u, 2.4);
      const fade = Math.max(0.3, 1 - Math.max(0, u - 0.65) * 1.5);
      const haloR = 22 + ease * 16;

      // Sacred octagonal / circular gold-and-ink halo
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2 + ease * 0.4;
        const a1 = ((i + 0.82) / segs) * Math.PI * 2 + ease * 0.4;
        stampInkStroke(
          ink,
          Math.cos(a0) * haloR,
          Math.sin(a0) * haloR,
          Math.cos(a1) * haloR,
          Math.sin(a1) * haloR,
          3.2,
          0.22,
          0.92 * fade,
          i % 2 === 0 ? 1 : 0,
        );
      }

      // Radiant mudra rays bursting outward
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r0 = haloR + 3;
        const r1 = r0 + 5 + Math.sin(u * Math.PI) * 10;
        stampInkStroke(
          ink,
          Math.cos(a) * r0,
          Math.sin(a) * r0,
          Math.cos(a) * r1,
          Math.sin(a) * r1,
          2.4,
          0.2,
          0.88 * fade,
          1,
        );
      }

      // Central cultivation emblem
      stampInkStroke(ink, 0, -11, 0, 11, 3.1, 0.18, 0.94 * fade, 1);
      stampInkDrop(ink, 0, 0, 4.4, 0.9 * fade, 0);

      compositeInkFrame(ink, frame, {
        palette: opts.palette,
        defaultPalette: meta.defaultPalette,
        paperBackground: Boolean(opts.paperBackground),
        grainRoughness: opts.grainRoughness ?? 1.0,
      });
    },
  };
}
