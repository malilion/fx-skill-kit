// Straight-alpha RGBA, row-major, with source-over compositing.
export function createFrame(w, h, ox = w / 2, oy = h / 2) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 2 || h < 2) {
    throw new Error('Frame dimensions must be integers >= 2');
  }
  return { w, h, ox, oy, data: new Uint8ClampedArray(w * h * 4) };
}

export function clear(frame) {
  frame.data.fill(0);
}

export function setPixel(frame, x, y, [r, g, b, a = 255]) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= frame.w || y >= frame.h || a <= 0) return;
  const i = (y * frame.w + x) * 4;
  const sa = Math.min(255, a) / 255;
  const da = frame.data[i + 3] / 255;
  const out = sa + da * (1 - sa);
  frame.data[i] = (r * sa + frame.data[i] * da * (1 - sa)) / out;
  frame.data[i + 1] = (g * sa + frame.data[i + 1] * da * (1 - sa)) / out;
  frame.data[i + 2] = (b * sa + frame.data[i + 2] * da * (1 - sa)) / out;
  frame.data[i + 3] = out * 255;
}

// Pixel-center coverage. softness=1 fades across the whole radius.
export function fillCircle(frame, cx, cy, radius, color, softness = 0) {
  if (!(radius > 0)) return;
  const feather = Math.max(0.75, radius * Math.max(0, Math.min(1, softness)));
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(frame.h, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(frame.w, Math.ceil(cx + radius)); x++) {
      const coverage = Math.max(0, Math.min(1, (radius - Math.hypot(x + 0.5 - cx, y + 0.5 - cy)) / feather));
      if (coverage) setPixel(frame, x, y, [color[0], color[1], color[2], (color[3] ?? 255) * coverage]);
    }
  }
}
