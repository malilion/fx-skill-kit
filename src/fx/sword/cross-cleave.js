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
  id: 'sword/cross-cleave',
  category: 'sword',
  duration: 0.85,
  loop: false,
  sim: true,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: ['#f4efe6', '#dfb8b0', '#a85249', '#63201b', '#1c1211', '#c83228'],
};

export const act = {
  windup: 0.25,
  poses: [
    [-0.25, 'TWIN_READY'],
    [0.00,  'FIRST_SLASH', 'snap'],
    [0.14,  'SECOND_SLASH', 'snap'],
    [0.24,  'CROSS_LOCK'],
    [0.72,  'SHEATH_END'],
  ],
  hits: [
    { t: 0.04, freeze: 0.08, shakeAmp: 2, inkSplash: 16 },
    { t: 0.18, freeze: 0.14, shakeAmp: 4, inkSplash: 28 },
  ],
  recovery: 0.1,
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

  const sparks = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const speed = 55 + rand() * 85;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1.6 + rand() * 2.2,
      tint: rand() < 0.35 ? 1 : 0,
    };
  });

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

      if (this.t < 0) {
        const w = Math.max(0, 1 + this.t / act.windup);
        stampDryBrush(ink, -24, -22, 3 + w * 4, 0.2, 0.5 + 0.4 * w, 1);
        stampDryBrush(ink, 24, -22, 3 + w * 4, 0.2, 0.5 + 0.4 * w, 0);
        compositeInkFrame(ink, frame, { palette: opts.palette, defaultPalette: meta.defaultPalette });
        return;
      }

      const p1 = Math.min(1, (this.t + 0.02) / 0.12);
      const fade1 = Math.max(0.14, 1 - Math.max(0, this.t - 0.22) / 0.72);
      const steps1 = Math.max(5, Math.floor(42 * p1));
      for (let i = 0; i <= steps1; i++) {
        const u = i / 42;
        const x = -44 + u * 88;
        const y = -40 + u * 80 + Math.sin(u * Math.PI) * 6;
        // Maintain stroke width while evaporating intensity and increasing dry-brush feibai
        const r = (1.8 + Math.sin(u * Math.PI) * 5.6) * (0.62 + 0.38 * fade1);
        const dry = u * 0.55 + (1 - fade1) * 0.35;
        stampDryBrush(ink, x, y, r, dry, fade1, u > 0.72 ? 1 : 0);
      }

      if (this.t >= 0.1) {
        const p2 = Math.min(1, (this.t - 0.1) / 0.11);
        const fade2 = Math.max(0.16, 1 - Math.max(0, this.t - 0.28) / 0.66);
        const steps2 = Math.max(5, Math.floor(42 * p2));
        for (let i = 0; i <= steps2; i++) {
          const u = i / 42;
          const x = 44 - u * 88;
          const y = -40 + u * 80 - Math.sin(u * Math.PI) * 6;
          const r = (2.0 + Math.sin(u * Math.PI) * 6.0) * (0.62 + 0.38 * fade2);
          const dry = u * 0.52 + (1 - fade2) * 0.35;
          stampDryBrush(ink, x, y, r, dry, fade2, 1);
        }
      }

      if (this.t >= 0.14) {
        const burstAge = Math.min(0.68, this.t - 0.14);
        const k = Math.max(0.12, 1 - burstAge / 0.68);
        const distScale = 1 - Math.pow(1 - burstAge / 0.68, 2.2);
        stampDryBrush(ink, 0, 0, 7 * k + 2.5, 0.12, k * 0.95, 1);
        for (const s of sparks) {
          const sx = Math.max(-56, Math.min(56, s.vx * distScale * 0.62));
          const sy = Math.max(-56, Math.min(56, s.vy * distScale * 0.62));
          stampInkDrop(ink, sx, sy, s.r * (0.55 + 0.45 * k), k * 0.9, s.tint);
        }
      }

      if (this.t > 0.2) {
        stepInkDiffusion(ink, 1 / 60, { threshold: 0.1, diffusionRate: 0.18, fringeStrength: 0.14 });
      }

      compositeInkFrame(ink, frame, { palette: opts.palette, defaultPalette: meta.defaultPalette });
    },
  };
}
