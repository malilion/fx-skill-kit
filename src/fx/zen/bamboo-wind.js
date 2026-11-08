import { mulberry32 } from '../../core/seed.js';
import {
  createInkFrame,
  clearInkFrame,
  stampDryBrush,
  stampInkStroke,
  compositeInkFrame,
} from '../../core/ink.js';
import { viewPoint } from '../../core/view.js';

export const meta = {
  id: 'zen/bamboo-wind',
  category: 'zen',
  duration: 2.0,
  loop: true,
  sim: false,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: ['#f4efe6', '#b8d0d2', '#649a91', '#2c6e7f', '#122a32', '#2c6e7f'],
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });
  const basePhase = rand() * Math.PI * 2;

  // Symmetric leaf pairs keep the overall center of mass balanced while orbiting smoothly.
  const leaves = Array.from({ length: 8 }, (_, i) => ({
    phase: basePhase + (i / 8) * Math.PI * 2,
    orbitR: 22 + (i % 2) * 12,
    len: 10 + (i % 3) * 2,
    tint: i % 4 === 0 ? 1 : 0,
  }));

  return {
    t: 0,
    step(dt) {
      this.t += dt;
    },
    draw(frame) {
      clearInkFrame(ink);
      const origin = viewPoint(0, 0, opts.tiltX, opts.tiltY, 10, 8);
      ink.ox = meta.ox + origin.x;
      ink.oy = meta.oy + origin.y;

      const u = (this.t / meta.duration) * Math.PI * 2;
      // Cosine sway has zero velocity at u=0 / u=2pi seam for ultra-smooth wrap
      const sway = (1 - Math.cos(u)) * 2.5 - 2.5;

      // Calligraphic bamboo stalk segments in background
      stampInkStroke(ink, -26 + sway * 0.3, 42, -20 + sway * 0.6, -6, 3.2, 0.28, 0.78, 0);
      stampInkStroke(ink, -19 + sway * 0.6, -10, -12 + sway * 0.9, -46, 2.7, 0.32, 0.72, 0);
      stampInkStroke(ink, -24 + sway * 0.6, -8, -15 + sway * 0.6, -8, 2.0, 0.15, 0.92, 1);

      // Swirling wind mist ring
      for (let i = 0; i < 24; i++) {
        const a = u + (i / 24) * Math.PI * 2;
        const wx = Math.cos(a) * 34;
        const wy = Math.sin(a) * 24;
        stampDryBrush(ink, wx, wy, 2.2, 0.42, 0.58, 0);
      }

      // Drifting bamboo leaves along periodic wind path
      for (const leaf of leaves) {
        const a = u + leaf.phase;
        const cx = Math.cos(a) * leaf.orbitR;
        const cy = Math.sin(a) * (leaf.orbitR * 0.78);
        const angle = a + Math.PI * 0.5;
        const dx = Math.cos(angle) * (leaf.len * 0.5);
        const dy = Math.sin(angle) * (leaf.len * 0.5);
        stampInkStroke(ink, cx - dx, cy - dy, cx + dx, cy + dy, 2.1, 0.2, 0.88, leaf.tint);
        stampDryBrush(ink, cx, cy, 2.6, 0.15, 0.92, leaf.tint);
      }

      compositeInkFrame(ink, frame, { palette: opts.palette, defaultPalette: meta.defaultPalette });
    },
  };
}
