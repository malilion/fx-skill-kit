import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'system/battery-charge',
  name: 'Fast Battery Charge',
  category: 'system',
  tags: ['oledfx', 'ssd1306', '1bit', 'system', 'battery'],
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
      const wave = 0.5 + 0.5 * (1 - Math.cos(phase));
      const ox = Math.round(clampTilt(opts.lookX ?? opts.tiltX ?? 0) * 4);
      const oy = Math.round(clampTilt(opts.lookY ?? opts.tiltY ?? 0) * 2);

      // Top voltage rail bar (y < 16)
      screen.fillRect(22, 5, 84, 3, 1.0);
      const halfRail = 12 + Math.round(wave * 24);
      screen.fillRect(64 - halfRail, 10, halfRail * 2, 3, 1.0);

      // Battery shell (main blue zone)
      const bx = 26 + ox;
      const by = 22 + oy;
      screen.fillRoundRect(bx, by, 72, 30, 4, 1.0);
      screen.fillRoundRect(bx + 3, by + 3, 66, 24, 2, 0.0);
      screen.fillRect(bx + 72, by + 9, 5, 12, 1.0);

      // Symmetrical charge core inside battery
      const fillW = 18 + Math.round(wave * 40);
      screen.fillRect(bx + 36 - Math.floor(fillW / 2), by + 6, fillW, 18, 1.0);

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
