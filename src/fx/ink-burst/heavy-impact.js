import { mulberry32 } from '../../core/seed.js';
import {
  createInkFrame,
  clearInkFrame,
  stampDryBrush,
  stampInkDrop,
  stepInkDiffusion,
  compositeInkFrame,
} from '../../core/ink.js';
import { viewPoint } from '../../core/view.js';

export const meta = {
  id: 'ink-burst/heavy-impact',
  category: 'ink-burst',
  duration: 0.8,
  loop: false,
  sim: true,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: ['#f4efe6', '#c9c2b8', '#7d766d', '#3b3734', '#161412', '#b82921'],
};

export const act = {
  windup: 0.15,
  poses: [
    [-0.15, 'GATHER_FORCE'],
    [0.00,  'IMPACT_CORE', 'snap'],
    [0.12,  'SHOCK_RING'],
    [0.65,  'MIST_SETTLE'],
  ],
  hits: [{ t: 0.02, freeze: 0.14, shakeAmp: 4, inkSplash: 32 }],
  recovery: 0.1,
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

  const shards = Array.from({ length: 26 }, (_, i) => {
    const angle = (i / 26) * Math.PI * 2 + (rand() - 0.5) * 0.18;
    const speed = 75 + rand() * 125;
    return {
      x: Math.cos(angle) * 4,
      y: Math.sin(angle) * 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2.0 + rand() * 3.0,
      tint: rand() < 0.28 ? 1 : 0,
    };
  });

  return {
    t: 0,
    step(dt) {
      this.t += dt;
      if (this.t < 0) return;
      const freeze = this.t >= 0.02 && this.t < 0.16 ? 0.22 : 1;
      const stepDt = dt * freeze;
      for (const s of shards) {
        s.x += s.vx * stepDt;
        s.y += s.vy * stepDt;
        s.vx *= Math.pow(0.89, freeze);
        s.vy *= Math.pow(0.89, freeze);
      }
    },
    draw(frame) {
      clearInkFrame(ink);
      const origin = viewPoint(0, 0, opts.tiltX, opts.tiltY, 10, 10);
      ink.ox = meta.ox + origin.x;
      ink.oy = meta.oy + origin.y;

      if (this.t < 0) {
        const w = Math.max(0, 1 + this.t / act.windup);
        stampDryBrush(ink, 0, 0, 5 + (1 - w) * 8, 0.25, 0.55 + 0.35 * w, 1);
        compositeInkFrame(ink, frame, { palette: opts.palette, defaultPalette: meta.defaultPalette });
        return;
      }

      // Rapid initial burst in first 15% of active time, slow dissipation over remaining 85%
      const burstP = Math.min(1, (this.t + 0.02) / 0.12);
      const decay = Math.max(0.1, 1 - Math.max(0, this.t - 0.12) / 0.72);
      const ringR = 8 + 38 * Math.pow( Math.min(1, this.t / 0.75), 0.45 );

      // Central dense scorched-ink core
      stampDryBrush(ink, 0, 0, (14 - burstP * 3) * decay + 3, 0.12, decay * 0.96, 0);
      stampDryBrush(ink, 0, 0, 6 * decay + 2, 0.08, decay * 0.9, 1);

      // Shockwave dry-brush ring
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const rx = Math.cos(a) * ringR;
        const ry = Math.sin(a) * ringR;
        stampDryBrush(ink, rx, ry, 2.8 * decay + 1, 0.35 + (1 - decay) * 0.35, decay * 0.85, i % 5 === 0 ? 1 : 0);
      }

      // Flying ink splatters
      for (const s of shards) {
        const sx = Math.max(-56, Math.min(56, s.x));
        const sy = Math.max(-56, Math.min(56, s.y));
        stampInkDrop(ink, sx, sy, s.r * (0.45 + 0.55 * decay), decay * 0.9, s.tint);
      }

      if (this.t > 0.06) {
        stepInkDiffusion(ink, 1 / 60, { threshold: 0.08, diffusionRate: 0.24, fringeStrength: 0.18 });
      }

      compositeInkFrame(ink, frame, { palette: opts.palette, defaultPalette: meta.defaultPalette });
    },
  };
}
