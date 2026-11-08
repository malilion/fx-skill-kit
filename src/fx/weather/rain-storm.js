import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'weather/rain-storm',
  category: 'weather',
  duration: 1.5,
  loop: true,
  sim: false,
  w: 128,
  h: 64,
  ox: 64,
  oy: 32,
  profile: 'ssd1306-128x64',
};

const COLUMNS = [28, 40, 52, 64, 76, 88, 100];

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
      const shiftX = Math.round(clampTilt(opts.tiltX) * 6);

      // Storm cloud silhouette (connected solid + Bayer under-shadow)
      screen.fillCircle(44 + shiftX, 15, 10, 1.0);
      screen.fillCircle(62 + shiftX, 12, 12, 1.0);
      screen.fillCircle(82 + shiftX, 15, 10, 1.0);
      screen.fillRoundRect(34 + shiftX, 14, 58, 11, 5, 1.0);
      screen.fillRect(38 + shiftX, 22, 50, 3, 0.65, 'bayer4x4');

      // Periodic rain streaks: two vertical waves per column so wrap at u=0 is seamless
      COLUMNS.forEach((baseX, idx) => {
        const colPhase = (u + idx / COLUMNS.length) % 1;
        for (let row = 0; row < 2; row++) {
          const p = (colPhase + row * 0.5) % 1;
          const dy = Math.round(26 + p * 26);
          const dx = baseX + shiftX;
          screen.fillRect(dx, dy, 2, 5, 1.0);
        }
        // Rippling puddle bars driven by harmonic phase
        const ripple = Math.round((0.5 + 0.5 * Math.cos(phase + idx * 0.9)) * 4);
        screen.fillRect(baseX + shiftX - ripple, 56, 2 + ripple * 2, 2, 1.0);
      });

      screen.fillRect(24 + shiftX, 58, 80, 2, 0.75, 'bayer4x4');
      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
