import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'system/wifi-pulse',
  category: 'system',
  duration: 1.6,
  loop: true,
  sim: false,
  w: 128,
  h: 64,
  ox: 64,
  oy: 48,
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
      const cx = 64 + Math.round(clampTilt(opts.tiltX) * 6);
      const cy = 50 + Math.round(clampTilt(opts.tiltY) * 4);

      // Transmitter base node
      screen.fillCircle(cx, cy, 4, 1.0);

      // Three concentric Wi-Fi signal arcs with cyclic wave activation
      const radii = [13, 23, 33];
      radii.forEach((r, idx) => {
        const wave = Math.sin(phase - idx * 0.9);
        const mode = wave > -0.15 ? 'threshold' : 'bayer4x4';
        const val = wave > -0.15 ? 1.0 : 0.65;
        screen.arc(cx, cy, r, -Math.PI * 0.76, -Math.PI * 0.24, val, 3, mode);
      });

      // Status bar indicators in top zone (SSD1306 16px yellow header zone)
      screen.fillRoundRect(46, 4, 36, 6, 2, 0.75, 'bayer4x4');
      const dotX = 50 + Math.round((0.5 + 0.5 * Math.sin(phase)) * 24);
      screen.fillRect(dotX, 5, 4, 4, 1.0);

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
