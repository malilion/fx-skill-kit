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
  id: 'zen/plum-blossom',
  name: 'Winter Plum Blossom',
  category: 'zen',
  tags: ['inkfx', 'zen', 'plum', 'blossom', 'zhusha'],
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
      const sway = Math.cos(u * Math.PI * 2) * 3.0;

      // Gnarled plum trunk and secondary twigs
      stampInkStroke(ink, -48, 44, -2 + sway * 0.5, 2, 4.2, 0.28, 0.92, 0);
      stampInkStroke(ink, -2 + sway * 0.5, 2, 44 + sway, -34 - sway * 0.4, 3.0, 0.32, 0.86, 0);
      stampInkStroke(ink, -16 + sway * 0.3, 14, -34 - sway * 0.5, -26, 2.4, 0.3, 0.82, 0);

      // Five-petal cinnabar plum blossoms along the branches
      const blooms = [
        { x: -28 - sway * 0.5, y: -22, r: 5.4, phase: 0 },
        { x: 6 + sway * 0.6, y: -6, r: 6.0, phase: 1.2 },
        { x: 34 + sway * 0.9, y: -30 - sway * 0.3, r: 5.5, phase: 2.4 },
        { x: 20 + sway * 0.6, y: 16 + sway * 0.3, r: 4.8, phase: 3.6 },
      ];

      for (const b of blooms) {
        const breath = 1 + Math.cos(u * Math.PI * 2 + b.phase) * 0.08;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2 + 0.3;
          stampInkDrop(ink, b.x + Math.cos(a) * b.r * breath, b.y + Math.sin(a) * b.r * breath, 3.2, 0.9, 1);
        }
        stampInkDrop(ink, b.x, b.y, 2.0, 0.92, 0);
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
