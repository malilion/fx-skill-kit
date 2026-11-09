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
  id: 'sword/myriad-swords',
  name: 'Myriad Swords Convergence',
  category: 'sword',
  tags: ['inkfx', 'wuxia', 'sword', 'barrage', 'cinnabar'],
  duration: 1.4,
  loop: false,
  sim: true,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: mineralRamps.zhusha,
};

export const act = {
  windup: 0.2,
  poses: [
    [-0.20, 'SWORD_ARRAY_FORM'],
    [0.00, 'BARRAGE_RELEASE', 'snap'],
    [0.35, 'CONVERGE_IMPACT', 'snap'],
    [0.95, 'DISPERSION_HOLD'],
  ],
  hits: [{ t: 0.35, freeze: 0.1, shakeAmp: 3, inkSplash: 20 }],
  recovery: 0.25,
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

  const swords = Array.from({ length: 11 }, (_, i) => ({
    x0: -48 + (i / 10) * 96 + (rand() - 0.5) * 4,
    delay: (i % 4) * 0.055,
    len: 20 + rand() * 8,
    tilt: (i / 10 - 0.5) * 0.48,
    tint: i % 3 === 0 ? 1 : 0,
  }));

  const splashes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + (rand() - 0.5) * 0.2;
    return {
      dx: Math.cos(a),
      dy: Math.sin(a) * 0.55,
      dist: 12 + rand() * 26,
      r: 1.8 + rand() * 1.8,
      tint: i % 2 === 0 ? 1 : 0,
    };
  });

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

      const u = Math.max(0, Math.min(1, (this.t + 0.2) / (meta.duration + 0.2)));
      const fade = Math.max(0.28, 1 - Math.max(0, u - 0.68) * 1.6);

      // Ground formation array ring
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + u * 1.6;
        stampInkDrop(ink, Math.cos(a) * 32, 34 + Math.sin(a) * 10, 2.3, 0.72 * fade, i % 3 === 0 ? 1 : 0);
      }

      // Descending sword barrage converging toward (0, 32)
      for (const s of swords) {
        const p = Math.max(0.05, Math.min(1, (u - s.delay) / 0.65));
        const ease = 1 - Math.pow(1 - p, 2.2);
        const cx = s.x0 * (1 - 0.52 * ease);
        const cy = -48 + ease * 78;
        const dx = Math.sin(s.tilt) * (s.len * 0.5);
        const dy = Math.cos(s.tilt) * (s.len * 0.5);
        stampInkStroke(ink, cx - dx, cy - dy, cx + dx, cy + dy, 2.3, 0.28, 0.88 * fade, s.tint);
        stampInkDrop(ink, cx - dx * 0.7, cy - dy * 0.7, 2.5, 0.85 * fade, 1);
      }

      // Ground impact splashes
      if (this.t >= 0.08) {
        const bu = Math.min(1, (this.t - 0.08) / 1.1);
        for (const sp of splashes) {
          const d = sp.dist * Math.pow(bu, 0.68);
          stampDryBrush(ink, sp.dx * d, 32 + sp.dy * d, sp.r, 0.22, 0.8 * fade, sp.tint);
        }
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
