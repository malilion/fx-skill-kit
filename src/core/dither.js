// 1-bit grayscale-to-monochrome dithering engine.
// Ordered 4x4 Bayer matrix yields 17 stable grayscale steps without temporal shimmering.
export const BAYER_4X4 = [
   0 / 16,  8 / 16,  2 / 16, 10 / 16,
  12 / 16,  4 / 16, 14 / 16,  6 / 16,
   3 / 16, 11 / 16,  1 / 16,  9 / 16,
  15 / 16,  7 / 16, 13 / 16,  5 / 16,
];

export function ditherSample(x, y, luma, mode = 'threshold') {
  const v = Math.max(0, Math.min(1, luma));
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  const xi = Math.floor(x) & 3;
  const yi = Math.floor(y) & 3;
  if (mode === 'bayer4x4') {
    const threshold = (BAYER_4X4[yi * 4 + xi] + 0.5 / 16);
    return v >= threshold ? 1 : 0;
  }
  if (mode === 'checker') {
    if (v < 0.25) return 0;
    if (v >= 0.75) return 1;
    return ((Math.floor(x) ^ Math.floor(y)) & 1) === 0 ? 1 : 0;
  }
  return v >= 0.5 ? 1 : 0;
}

// Full-buffer dithering supporting threshold, bayer4x4, checker, and atkinson error diffusion.
export function ditherBuffer(gray, w, h, mode = 'bayer4x4') {
  const out = new Uint8Array(w * h);
  if (mode === 'atkinson') {
    const work = Float32Array.from(gray);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const oldVal = Math.max(0, Math.min(1, work[idx]));
        const bit = oldVal >= 0.5 ? 1 : 0;
        out[idx] = bit;
        const err = (oldVal - bit) / 8;
        if (x + 1 < w) work[idx + 1] += err;
        if (x + 2 < w) work[idx + 2] += err;
        if (y + 1 < h) {
          if (x > 0) work[idx + w - 1] += err;
          work[idx + w] += err;
          if (x + 1 < w) work[idx + w + 1] += err;
        }
        if (y + 2 < h) work[idx + w * 2] += err;
      }
    }
    return out;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      out[idx] = ditherSample(x, y, gray[idx], mode);
    }
  }
  return out;
}
