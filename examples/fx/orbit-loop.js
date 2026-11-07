import { fillCircle } from '../../src/core/frame.js';
import { mulberry32 } from '../../src/core/seed.js';
import { paletteColors } from '../../src/core/palette.js';
import { clampTilt, viewPoint } from '../../src/core/view.js';

export const meta = { id: 'orbit-loop', duration: 2, loop: true, w: 160, h: 160, ox: 80, oy: 80 };

export function create({ seed = 1, palette, tiltX = 0, tiltY = 0 } = {}) {
  const [primary, accent = primary] = paletteColors(palette, ['#394c55', '#206f7f']);
  const phase = mulberry32(seed)() * Math.PI * 2;
  const tilt = { x: clampTilt(tiltX), y: clampTilt(tiltY) };
  return {
    t: 0,
    step(dt) { this.t += dt; },
    draw(frame) {
      const angle = this.t / meta.duration * Math.PI * 2 + phase;
      const origin = viewPoint(frame.ox, frame.oy, tilt.x, tilt.y);
      const rx = 43 * (1 - Math.abs(tilt.y) * 0.22);
      const ry = 32 * (1 - Math.abs(tilt.x) * 0.22);
      fillCircle(frame, origin.x, origin.y, 4, [...primary, 180], 0.5);
      for (let i = 18; i >= 0; i--) {
        const a = angle - i * 0.075;
        const x = origin.x + Math.cos(a) * rx;
        const y = origin.y + Math.sin(a) * ry;
        fillCircle(frame, x, y, 2 + (18 - i) * 0.22, [...accent, (1 - i / 19) * 210], 0.55);
      }
    },
  };
}
