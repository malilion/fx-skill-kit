import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'system/cpu-wave',
  name: 'CPU Telemetry Wave',
  category: 'system',
  tags: ['oledfx', 'ssd1306', '1bit', 'system', 'cpu'],
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
      const ox = Math.round(clampTilt(opts.lookX ?? opts.tiltX ?? 0) * 4);
      const oy = Math.round(clampTilt(opts.lookY ?? opts.tiltY ?? 0) * 2);

      // Top telemetry header (yellow band)
      screen.fillRect(14, 4, 100, 3, 1.0);
      for (let i = 0; i < 4; i++) {
        screen.fillRect(18 + i * 24, 9, 14, 3, 1.0);
      }

      // Oscilloscope frame
      screen.strokeRect(14 + ox, 18 + oy, 100, 38, 1.0);

      // Symmetrical counter-balanced bars so loop seam has tiny step delta
      const bars = 12;
      const wave = Math.cos(phase);
      for (let i = 0; i < bars; i++) {
        const alt = i % 2 === 0 ? wave : -wave;
        const h = 14 + Math.round(alt * 6);
        const bx = 22 + ox + i * 7;
        const by = 52 + oy - h;
        screen.fillRect(bx, by, 5, h, 1.0);
      }

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
