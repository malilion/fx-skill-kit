import { fillCircle } from '../../src/core/frame.js';
import { mulberry32 } from '../../src/core/seed.js';
import { paletteColors } from '../../src/core/palette.js';

export const meta = { id: 'orbit-loop', duration: 2, loop: true, w: 160, h: 160, ox: 80, oy: 80 };

export function create({ seed = 1, palette } = {}) {
  const [primary, accent = primary] = paletteColors(palette, ['#394c55', '#206f7f']);
  const phase = mulberry32(seed)() * Math.PI * 2;
  return {
    t: 0,
    step(dt) { this.t += dt; },
    draw(frame) {
      const angle = this.t / meta.duration * Math.PI * 2 + phase;
      fillCircle(frame, frame.ox, frame.oy, 4, [...primary, 180], 0.5);
      for (let i = 18; i >= 0; i--) {
        const a = angle - i * 0.075;
        const x = frame.ox + Math.cos(a) * 43;
        const y = frame.oy + Math.sin(a) * 32;
        fillCircle(frame, x, y, 2 + (18 - i) * 0.22, [...accent, (1 - i / 19) * 210], 0.55);
      }
    },
  };
}
