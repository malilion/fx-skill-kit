import { createOledScreen } from '../../core/oled.js';

export const meta = {
  id: 'transitions/venetian-blinds',
  name: 'Venetian Blind Shutter',
  category: 'transitions',
  tags: ['oledfx', 'ssd1306', '1bit', 'transition', 'shutter'],
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
      const arch = Math.sin(u * Math.PI);
      const slats = 6;
      const bandH = 9;

      for (let i = 0; i < slats; i++) {
        const y0 = 6 + i * bandH;
        const slatH = 2 + Math.round(arch * 4);
        const sweepW = Math.round(32 + (1 - Math.abs(u - 0.5) * 1.2) * 72);
        const x0 = Math.round(64 - sweepW / 2);
        screen.fillRect(x0, y0, sweepW, slatH, 1.0);
      }

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
