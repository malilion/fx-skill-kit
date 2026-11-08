import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'eyes/cyber-charge',
  name: 'Cyber Charge Eyes',
  category: 'eyes',
  tags: ['oledfx', 'ssd1306', '1bit', 'eyes', 'cyber'],
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
      const charge = 0.5 + 0.5 * (1 - Math.cos(phase));
      const gx = Math.round(clampTilt(opts.lookX ?? opts.tiltX ?? 0) * 5);
      const gy = Math.round(clampTilt(opts.lookY ?? opts.tiltY ?? 0) * 3);

      // Top HUD bar (yellow zone y < 16)
      screen.fillRect(14, 4, 100, 3, 1.0);
      const halfBar = 14 + Math.round(charge * 34);
      screen.fillRect(64 - halfBar, 9, halfBar * 2, 4, 1.0);

      // Twin cyber visor eyes in main zone (y >= 16)
      const drawVisorEye = (cx, cy) => {
        screen.fillRoundRect(cx - 18, cy - 11, 36, 22, 4, 1.0);
        screen.fillRoundRect(cx - 14, cy - 7, 28, 14, 2, 0.0);
        const coreW = 8 + Math.round(charge * 14);
        const coreH = 6 + Math.round(charge * 4);
        screen.fillRect(cx - Math.floor(coreW / 2), cy - Math.floor(coreH / 2), coreW, coreH, 1.0);
      };

      drawVisorEye(38 + gx, 38 + gy);
      drawVisorEye(90 + gx, 38 + gy);

      // Symmetric bottom charge ticks
      for (let i = 0; i < 6; i++) {
        screen.fillRect(34 + i * 11, 55, 7, 3, 1.0);
      }

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
