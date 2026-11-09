import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'weather/sunny-orbit',
  name: 'Sunny Ray Orbit',
  category: 'weather',
  tags: ['oledfx', 'ssd1306', '1bit', 'weather', 'sun'],
  duration: 2.0,
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
      const baseAngle = Math.cos(u * Math.PI * 2) * 0.35;
      const pulse = Math.cos(u * Math.PI * 2);
      const cx = 64 + Math.round(clampTilt(opts.lookX ?? opts.tiltX ?? 0) * 6);
      const cy = 36 + Math.round(clampTilt(opts.lookY ?? opts.tiltY ?? 0) * 4);

      // Top UV indicator bar (y < 16)
      screen.fillRect(24, 5, 80, 3, 1.0);
      const halfW = 12 + Math.round((1 + pulse) * 8);
      screen.fillRect(64 - halfW, 9, halfW * 2, 4, 1.0);

      // Sun core
      screen.fillCircle(cx, cy, 10, 1.0);
      screen.fillCircle(cx, cy, 7, 0.0);
      screen.fillCircle(cx, cy, 5, 1.0);

      // 8 symmetric sun rays
      for (let i = 0; i < 8; i++) {
        const a = baseAngle + i * (Math.PI / 4);
        const r = 15 + (i % 2 === 0 ? 1 : -1) * Math.round(pulse);
        const rx = cx + Math.round(Math.cos(a) * r);
        const ry = cy + Math.round(Math.sin(a) * r);
        screen.fillRect(rx - 2, ry - 2, 4, 4, 1.0);
      }

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
