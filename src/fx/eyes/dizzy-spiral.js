import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'eyes/dizzy-spiral',
  name: 'Dizzy Spiral Eyes',
  category: 'eyes',
  tags: ['oledfx', 'ssd1306', '1bit', 'eyes', 'dizzy'],
  duration: 1.6,
  loop: true,
  sim: false,
  w: 128,
  h: 64,
  ox: 64,
  oy: 32,
  profile: 'ssd1306-128x64',
};

export function create(opts = {}) {
  const screen = createOledScreen(meta.w, meta.h);
  return {
    t: 0,
    step(dt) {
      this.t += dt;
    },
    draw(frame) {
      screen.clear(0);
      const u = (((this.t % meta.duration) + meta.duration) % meta.duration) / meta.duration;
      const angle = u * Math.PI * 2;
      const gx = Math.round(clampTilt(opts.lookX ?? opts.tiltX ?? 0) * 4);
      const gy = Math.round(clampTilt(opts.lookY ?? opts.tiltY ?? 0) * 3);

      // Top status stars (counter-moving in yellow band)
      const starOff = Math.round(Math.cos(angle) * 6);
      screen.fillRect(34 + starOff, 6, 4, 4, 1.0);
      screen.fillRect(90 - starOff, 6, 4, 4, 1.0);

      const drawSpiralEye = (cx, cy, dir) => {
        screen.fillCircle(cx, cy, 14, 1.0);
        screen.fillCircle(cx, cy, 11, 0.0);
        screen.fillCircle(cx, cy, 7, 1.0);
        screen.fillCircle(cx, cy, 4, 0.0);
        const a = angle * dir;
        const ox = Math.round(Math.cos(a) * 8);
        const oy = Math.round(Math.sin(a) * 8);
        screen.fillRect(cx + ox - 2, cy + oy - 2, 4, 4, 1.0);
        screen.fillRect(cx - ox - 2, cy - oy - 2, 4, 4, 1.0);
        screen.fillRect(cx - 2, cy - 2, 4, 4, 1.0);
      };

      drawSpiralEye(38 + gx, 38 + gy, 1);
      drawSpiralEye(90 + gx, 38 + gy, -1);

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
