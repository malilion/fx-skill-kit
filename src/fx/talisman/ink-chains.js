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
  id: 'talisman/ink-chains',
  name: 'Binding Ink Chains',
  category: 'talisman',
  tags: ['inkfx', 'talisman', 'chains', 'bind', 'shiqing'],
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
      const pulse = Math.cos(phase);

      const chains = [
        { x0: -48, y0: -42, x1: 48, y1: 42, sign: 1 },
        { x0: 48, y0: -42, x1: -48, y1: 42, sign: -1 },
      ];

      for (const c of chains) {
        const links = 7;
        for (let i = 0; i < links; i++) {
          const f0 = i / links;
          const f1 = (i + 0.78) / links;
          const sway0 = Math.sin((f0 * 2 - 1) * Math.PI) * pulse * 4.2 * c.sign;
          const sway1 = Math.sin((f1 * 2 - 1) * Math.PI) * pulse * 4.2 * c.sign;
          const lx0 = c.x0 + (c.x1 - c.x0) * f0 + sway0;
          const ly0 = c.y0 + (c.y1 - c.y0) * f0 - sway0 * 0.5;
          const lx1 = c.x0 + (c.x1 - c.x0) * f1 + sway1;
          const ly1 = c.y0 + (c.y1 - c.y0) * f1 - sway1 * 0.5;
          stampInkStroke(ink, lx0, ly0, lx1, ly1, 2.8, 0.25, 0.88, i % 2 === 1 ? 1 : 0);
        }
      }

      // Central shackle ring pulsing in place
      const ringR = 16 + pulse * 2.2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        stampInkDrop(ink, Math.cos(a) * ringR, Math.sin(a) * ringR, 2.7, 0.9, i % 3 === 0 ? 1 : 0);
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
