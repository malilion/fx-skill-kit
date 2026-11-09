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
  id: 'ink-burst/qi-surge',
  name: 'Blood Qi Surge',
  category: 'ink-burst',
  tags: ['inkfx', 'wuxia', 'burst', 'qi', 'zhusha'],
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
  windup: 0.15,
  poses: [
    [-0.15, 'DANTIAN_GATHER'],
    [0.00, 'QI_ERUPT', 'snap'],
    [0.50, 'AURA_PILLAR'],
  ],
  hits: [{ t: 0.05, freeze: 0.08, shakeAmp: 3, inkSplash: 22 }],
  recovery: 0.2,
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

  const plumes = Array.from({ length: 13 }, (_, i) => ({
    xOff: (i / 12 - 0.5) * 64 + (rand() - 0.5) * 4,
    height: 44 + rand() * 34,
    delay: (Math.abs(i - 6) / 6) * 0.15,
    r: 2.5 + rand() * 1.4,
    tint: i % 2 === 0 ? 1 : 0,
  }));

  const droplets = Array.from({ length: 18 }, (_, i) => {
    const angle = -Math.PI * (0.18 + (i / 18) * 0.64);
    return {
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      speed: 22 + rand() * 28,
      r: 1.7 + rand() * 1.8,
      tint: i % 3 === 0 ? 1 : 0,
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

      const u = Math.max(0, Math.min(1, (this.t + 0.15) / (meta.duration + 0.15)));
      const fade = Math.max(0.28, 1 - Math.max(0, u - 0.62) * 1.55);
      const baseY = 38;

      // Ground shockwave ellipse
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        stampInkDrop(ink, Math.cos(a) * (16 + u * 22), baseY + Math.sin(a) * (5 + u * 7), 2.5, 0.82 * fade, i % 3 === 0 ? 1 : 0);
      }

      // Surging vertical qi columns
      for (const p of plumes) {
        const localU = Math.max(0.12, Math.min(1, (u - p.delay) / 0.72));
        const ease = 1 - Math.pow(1 - localU, 2.2);
        const px = p.xOff * (0.65 + ease * 0.35);
        const topY = baseY - p.height * ease;
        stampInkStroke(ink, px, baseY, px * 1.08, topY, p.r, 0.26, 0.88 * fade, p.tint);
      }

      // Rising cinnabar mist droplets
      for (const d of droplets) {
        const dist = d.speed * Math.pow(u, 0.7);
        const dx = Math.max(-54, Math.min(54, d.dx * dist));
        const dy = Math.max(-54, Math.min(54, baseY - 10 + d.dy * dist));
        stampDryBrush(ink, dx, dy, d.r, 0.2, 0.8 * fade, d.tint);
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
