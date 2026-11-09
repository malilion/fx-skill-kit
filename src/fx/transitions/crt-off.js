import { createOledScreen } from '../../core/oled.js';

export const meta = {
  id: 'transitions/crt-off',
  name: 'CRT Collapse Wipe',
  category: 'transitions',
  tags: ['oledfx', 'ssd1306', '1bit', 'transition', 'crt'],
  duration: 1.2,
  loop: false,
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
      const u = Math.max(0, Math.min(1, this.t / meta.duration));

      if (u < 0.55) {
        const p = u / 0.55;
        const halfH = Math.max(2, Math.round((1 - p) * 24));
        const halfW = Math.round(56 - p * 6);
        screen.fillRoundRect(64 - halfW, 32 - halfH, halfW * 2, halfH * 2, 4, 1.0);
        if (halfH > 6) {
          screen.fillRect(64 - halfW + 6, 32 - halfH + 4, (halfW - 6) * 2, (halfH - 4) * 2, 0.0);
          screen.fillRect(64 - halfW + 10, 30, (halfW - 10) * 2, 4, 1.0);
        }
      } else {
        const p = (u - 0.55) / 0.45;
        const halfW = Math.max(4, Math.round((1 - p) * 50));
        screen.fillRect(64 - halfW, 30, halfW * 2, 4, 1.0);
        screen.fillCircle(64, 32, Math.max(4, Math.round((1 - p * 0.4) * 7)), 1.0);
      }

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
