// Reference implementation: 參數化圓角矩形雙眼與月牙笑眼 (happy-squint.js)
import { createOledScreen } from '../../core/oled.js';
import { clampTilt } from '../../core/view.js';

export const meta = {
  id: 'eyes/happy-squint',
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
  const lookX = clampTilt(opts.lookX ?? opts.tiltX ?? 0) * 10;
  const lookY = clampTilt(opts.lookY ?? opts.tiltY ?? 0) * 6;
  const phase = ((t % meta.duration) + meta.duration) % meta.duration;

  let blink = 0;
  if (phase > 0.15 && phase < 0.35) {
    blink = Math.sin(((phase - 0.15) / 0.20) * Math.PI);
  }
  const smileArc = phase > 0.5 && phase < 1.6
    ? Math.sin(Math.min(1, (phase - 0.5) / 0.25) * (Math.PI / 2)) * (phase > 1.35 ? (1.6 - phase) / 0.25 : 1)
    : 0;

  const eyeW = 26;
  const eyeH = Math.max(4, Math.round(28 * (1 - blink * 0.88)));
  const centers = [40 + lookX, 88 + lookX];
  const cy = Math.round(32 + lookY - smileArc * 4);

  for (const cx of centers) {
    screen.fillRoundRect(cx - eyeW / 2, cy - eyeH / 2, eyeW, eyeH, 6, 1.0);
    if (smileArc > 0.05) {
      const cutOffset = Math.round(eyeH * (1.15 - smileArc * 0.55));
      screen.fillCircle(cx, cy + cutOffset, eyeW * 0.68, 0.0);
    }
  }

  // Subtle ordered-Bayer blush cheeks when smiling
  if (smileArc > 0.2) {
    screen.fillRoundRect(16 + lookX, 46 + lookY, 12, 6, 2, 0.72, 'bayer4x4');
    screen.fillRoundRect(100 + lookX, 46 + lookY, 12, 6, 2, 0.72, 'bayer4x4');
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
