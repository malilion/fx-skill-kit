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
  id: 'talisman/bagua-seal',
  category: 'talisman',
  duration: 2.0,
  loop: true,
  sim: false,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: ['#f4efe6', '#d8cba8', '#997b27', '#423618', '#15130f', '#d4af37'],
};

export function create(opts = {}) {
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });
  const phaseOffset = rand() * Math.PI * 2;
  const motes = Array.from({ length: 12 }, (_, i) => ({
    baseAngle: (i / 12) * Math.PI * 2,
    radius: 34 + (i % 3) * 8,
    size: 1.8 + (i % 2) * 0.9,
    tint: i % 3 === 0 ? 2 : 1,
  }));

  return {
    t: 0,
    step(dt) {
      this.t += dt;
    },
    draw(frame) {
      clearInkFrame(ink);
      const origin = viewPoint(0, 0, opts.tiltX, opts.tiltY, 9, 9);
      ink.ox = meta.ox + origin.x;
      ink.oy = meta.oy + origin.y;

      const phase = (this.t / meta.duration) * Math.PI * 2 + phaseOffset;
      const pulse = 0.85 + 0.15 * Math.cos(phase);

      // Outer calligraphic Bagua ring
      const ringRadius = 46;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2 + phase;
        const x = Math.cos(a) * ringRadius;
        const y = Math.sin(a) * ringRadius;
        const dry = 0.22 + 0.25 * Math.sin(i * 0.7);
        stampDryBrush(ink, x, y, 2.4 * pulse, dry, 0.82, i % 8 === 0 ? 2 : 0);
      }

      // 8 Bagua trigram bars around the circle
      for (let trigram = 0; trigram < 8; trigram++) {
        const a = (trigram / 8) * Math.PI * 2 - phase * 0.5;
        const cx = Math.cos(a) * 32;
        const cy = Math.sin(a) * 32;
        const tx = -Math.sin(a) * 6;
        const ty = Math.cos(a) * 6;
        stampInkStroke(ink, cx - tx, cy - ty, cx + tx, cy + ty, 1.9, 0.18, 0.88, trigram % 2 ? 1 : 0);
      }

      // Inner Taiji / Talisman core
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2 + phase;
        const r = 14;
        stampDryBrush(ink, Math.cos(a) * r, Math.sin(a) * r, 2.8, 0.15, 0.9, i < 10 ? 0 : 1);
      }
      stampDryBrush(ink, Math.cos(phase) * 6, Math.sin(phase) * 6, 4.2, 0.1, 0.95, 2);
      stampDryBrush(ink, -Math.cos(phase) * 6, -Math.sin(phase) * 6, 4.2, 0.1, 0.95, 1);

      for (const m of motes) {
        const a = m.baseAngle + phase;
        const r = m.radius + Math.sin(phase + m.baseAngle * 2) * 3;
        stampDryBrush(ink, Math.cos(a) * r, Math.sin(a) * r, m.size, 0.12, 0.85, m.tint);
      }

      compositeInkFrame(ink, frame, { palette: opts.palette, defaultPalette: meta.defaultPalette });
    },
  };
}
