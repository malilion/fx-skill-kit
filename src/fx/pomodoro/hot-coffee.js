import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'pomodoro/hot-coffee',
  category: 'pomodoro',
  duration: 2.0,
  loop: true,
  sim: false,
  w: 128,
  h: 64,
  ox: 64,
  oy: 40,
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
      const u = ((this.t % meta.duration) + meta.duration) / meta.duration;
      const phase = u * Math.PI * 2;
      const cx = 60 + Math.round(clampTilt(opts.tiltX) * 5);
      const baseY = 30 + Math.round(clampTilt(opts.tiltY) * 3);

      // Crisp 1-bit coffee cup body & handle (threshold mode)
      screen.fillRoundRect(cx - 16, baseY, 32, 22, 5, 1.0, 'threshold');
      screen.fillRect(cx - 12, baseY + 3, 24, 4, 0.0, 'threshold');
      screen.strokeRect(cx + 15, baseY + 4, 7, 12, 1.0, 'threshold');
      screen.strokeRect(cx + 16, baseY + 5, 5, 10, 1.0, 'threshold');
      screen.fillRoundRect(cx - 22, baseY + 23, 44, 4, 2, 1.0, 'threshold');

      // Ordered Bayer 4x4 dithered rising steam plumes
      for (let row = 0; row < 16; row++) {
        const y = baseY - 4 - row;
        const wave = Math.round(Math.cos(phase + row * 0.45) * 3);
        screen.fillRect(cx - 9 + wave, y, 5, 2, 0.75, 'bayer4x4');
        screen.fillRect(cx + 4 - wave, y, 5, 2, 0.75, 'bayer4x4');
      }

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
