import { fillCircle } from '../../src/core/frame.js';
import { mulberry32 } from '../../src/core/seed.js';

export const meta = { id: 'pulse-dot', duration: 1, loop: false, w: 160, h: 160, ox: 80, oy: 80 };

export function create({ seed = 1 } = {}) {
  const random = mulberry32(seed);
  const flecks = Array.from({ length: 24 }, () => ({
    angle: random() * Math.PI * 2, distance: 15 + random() * 34, radius: 1 + random() * 3,
  }));
  return {
    t: 0,
    step(dt) { this.t += dt; },
    draw(frame) {
      const p = Math.min(1, this.t / meta.duration);
      const envelope = Math.sin(Math.PI * p) ** 0.8;
      const radius = 8 + 30 * Math.sin(Math.PI * p * 0.85);
      fillCircle(frame, frame.ox, frame.oy, radius + 7, [37, 61, 68, 95 * envelope], 1);
      fillCircle(frame, frame.ox, frame.oy, radius, [30, 42, 46, 235 * envelope], 0.75);
      for (const fleck of flecks) {
        const d = fleck.distance * (0.35 + p * 0.65);
        fillCircle(frame, frame.ox + Math.cos(fleck.angle) * d, frame.oy + Math.sin(fleck.angle) * d,
          fleck.radius, [42, 64, 70, 155 * envelope], 0.6);
      }
    },
  };
}
