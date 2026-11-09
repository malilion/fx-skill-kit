import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'weather/snow-drift',
  name: 'Snow Drift Flurry',
  category: 'weather',
  tags: ['oledfx', 'ssd1306', '1bit', 'weather', 'snow'],
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
      const sway = Math.round(Math.cos(phase) * 3);
      const bob = Math.round(Math.sin(phase) * 3);
      const ox = Math.round(clampTilt(opts.lookX ?? opts.tiltX ?? 0) * 4);
      const oy = Math.round(clampTilt(opts.lookY ?? opts.tiltY ?? 0) * 2);

      // Top cloud silhouette in yellow band
      screen.fillRoundRect(26 + ox, 3, 76, 10, 4, 1.0);
      screen.fillRoundRect(30 + ox, 5, 68, 6, 2, 0.0);

      // Counter-phased snowflake pairs so loop seam has zero jump
      const flakes = [
        { x: 26, y: 24, sx: 1, sy: 1 },
        { x: 102, y: 40, sx: -1, sy: -1 },
        { x: 42, y: 38, sx: -1, sy: 1 },
        { x: 86, y: 26, sx: 1, sy: -1 },
        { x: 56, y: 24, sx: 1, sy: 1 },
        { x: 72, y: 40, sx: -1, sy: -1 },
        { x: 64, y: 32, sx: 0, sy: 1 },
        { x: 64, y: 44, sx: 0, sy: -1 },
      ];

      for (const f of flakes) {
        const fx = f.x + ox + sway * f.sx;
        const fy = f.y + oy + bob * f.sy;
        screen.fillRect(fx - 2, fy - 2, 4, 4, 1.0);
      }

      // Accumulated snow drift bank at bottom
      screen.fillRoundRect(16, 53, 96, 6, 2, 1.0);

      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
