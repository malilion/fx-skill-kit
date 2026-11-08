import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'pomodoro/hourglass-flip',
  name: 'Focus Hourglass Pulse',
  category: 'pomodoro',
  tags: ['oledfx', 'ssd1306', '1bit', 'pomodoro', 'timer'],
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
      const phase = u * Math.PI * 2;
      const sandShift = Math.round(Math.cos(phase) * 3);
      const cx = 64 + Math.round(clampTilt(opts.lookX ?? opts.tiltX ?? 0) * 4);
      const cy = 38 + Math.round(clampTilt(opts.lookY ?? opts.tiltY ?? 0) * 2);

      // Top Pomodoro progress bar (y < 16)
      screen.fillRect(24, 5, 80, 3, 1.0);
      screen.fillRect(36, 10, 56, 3, 1.0);

      // Top & bottom caps of hourglass
      screen.fillRect(cx - 16, cy - 18, 32, 4, 1.0);
      screen.fillRect(cx - 16, cy + 15, 32, 4, 1.0);

      // Side pillars
      screen.fillRect(cx - 14, cy - 14, 3, 29, 1.0);
      screen.fillRect(cx + 11, cy - 14, 3, 29, 1.0);

      // Upper & lower bulbs
      screen.fillRoundRect(cx - 9, cy - 13, 18, 11, 3, 1.0);
      screen.fillRoundRect(cx - 9, cy + 3, 18, 11, 3, 1.0);

      // Falling sand stream in neck
      screen.fillRect(cx - 2, cy - 3, 4, 7, 1.0);
      // Symmetrical sand cutouts inside bulbs
      const topVoid = 5 + sandShift;
      const botVoid = 5 - sandShift;
      screen.fillRect(cx - 6, cy - 11, 12, Math.max(2, topVoid), 0.0);
      screen.fillRect(cx - 6, cy + 5, 12, Math.max(2, botVoid), 0.0);

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
