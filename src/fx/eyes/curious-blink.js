// PRD 02 Section 2.4 Flagship: 好奇歪頭眨眼蓄力動畫 (eyes/curious-blink.js)
import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'eyes/curious-blink',
  category: 'eyes',
  duration: 2.0,
  loop: true,
  sim: false,
  w: 128,
  h: 64,
  ox: 64,
  oy: 32,
  profile: 'ssd1306-128x64',
};

export function draw(screen, t, opts = {}) {
  const u = (((t % meta.duration) + meta.duration) % meta.duration) / meta.duration;
  const angle = u * Math.PI * 2;
  // Cosine gaze curve rests smoothly at loop boundaries (u=0 and u=1)
  const lookX = clampTilt(opts.lookX ?? opts.tiltX ?? 0) * 9 + Math.round((1 - Math.cos(angle)) * 3 - 3);
  const lookY = clampTilt(opts.lookY ?? opts.tiltY ?? 0) * 5;

  // Expressive blink centered around t = 0.27s (u = 0.135) so 16-cell contact sheets capture the closed eye
  const blink = u > 0.06 && u < 0.21 ? Math.sin(((u - 0.06) / 0.15) * Math.PI) : 0;
  // Curious asymmetric squint around u = 0.35..0.80
  const curious = Math.max(0, Math.sin(angle - 0.9));

  const leftW = 24;
  const leftH = Math.max(4, Math.round((26 - curious * 8) * (1 - blink * 0.88)));
  const rightW = 26;
  const rightH = Math.max(4, Math.round((26 + curious * 5) * (1 - blink * 0.88)));

  const leftCx = 40 + lookX;
  const leftCy = Math.round(33 + lookY + curious * 3);
  const rightCx = 88 + lookX;
  const rightCy = Math.round(31 + lookY - curious * 3);

  screen.fillRoundRect(leftCx - leftW / 2, leftCy - leftH / 2, leftW, leftH, 6, 1.0);
  screen.fillRoundRect(rightCx - rightW / 2, rightCy - rightH / 2, rightW, rightH, 7, 1.0);

  // Inner specular highlight cutout for expressive gaze
  if (blink < 0.45) {
    screen.fillRect(leftCx - 6, leftCy - Math.floor(leftH / 4), 4, 4, 0.0);
    screen.fillRect(rightCx - 6, rightCy - Math.floor(rightH / 4), 5, 5, 0.0);
  }
}

export function create(opts = {}) {
  const screen = createOledScreen(meta.w, meta.h);
  return {
    t: 0,
    step(dt) {
      this.t += dt;
    },
    draw(frame) {
      screen.clear(0);
      draw(screen, this.t, opts);
      screen.toFrame(frame, { palette: opts.palette, dualZone: Boolean(opts.dualZone) });
    },
  };
}
