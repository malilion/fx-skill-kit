// Optional domain checks consume the toolkit's RGBA sample context.
export function inkEntropy({ minEntropy = 0.5, bins = 6 } = {}) {
  return { id: 'inkfx/entropy', run({ frames }) {
    const histogram = new Array(bins).fill(0);
    let total = 0;
    for (const { data } of frames) for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      // Density against white paper incorporates opacity as well as pigment luma.
      const density = (1 - (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255) * data[i + 3] / 255;
      histogram[Math.min(bins - 1, Math.floor(density * bins))]++; total++;
    }
    const entropy = histogram.reduce((h, n) => n ? h - n / total * Math.log2(n / total) : h, 0);
    return { pass: total > 0 && entropy >= minEntropy, detail: `density entropy ${entropy.toFixed(3)} bits >= ${minEntropy}` };
  } };
}

const packed = (frame, w, h) => {
  const out = new Uint8Array(w * Math.ceil(h / 8));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (frame.data[(y * w + x) * 4 + 3] >= 128) out[Math.floor(y / 8) * w + x] |= 1 << (y % 8);
  }
  return out;
};
// Exact packet size for XOR + repeated/literal byte RLE (128-byte packets).
function rleSize(data) {
  let size = 0, pos = 0;
  while (pos < data.length) {
    let end = pos + 1;
    while (end < data.length && end - pos < 128 && data[end] === data[pos]) end++;
    if (end - pos >= 2) { size += 2; pos = end; continue; }
    end = pos + 1;
    while (end < data.length && end - pos < 128 && !(end + 1 < data.length && data[end] === data[end + 1])) end++;
    size += 1 + end - pos; pos = end;
  }
  return size;
}
export function oledRLEBudget({ maxBytes = 4096 } = {}) {
  return { id: 'oledfx/rle-budget', run({ frames, meta }) {
    const samples = meta.loop ? frames.slice(0, -1) : frames;
    let previous, bytes = samples.length * 4; // Include uint32 offset table.
    for (const frame of samples) {
      const data = packed(frame, meta.w, meta.h);
      const delta = data.map((b, i) => b ^ (previous?.[i] ?? 0));
      bytes += rleSize(delta); previous = data;
    }
    return { pass: bytes < maxBytes, detail: `XOR-RLE + offsets ${bytes} bytes < ${maxBytes}` };
  } };
}
export function oledShimmer({ maxRate = 0.1 } = {}) {
  return { id: 'oledfx/shimmer', run({ frames, meta: { w, h, loop } }) {
    const lit = (frame, x, y) => x >= 0 && y >= 0 && x < w && y < h && frame.data[(y * w + x) * 4 + 3] >= 128;
    let toggles = 0, litPixels = 0;
    const samples = loop ? frames.slice(0, -1) : frames;
    samples.forEach((frame, index) => {
      const before = samples[index - 1] ?? (loop ? samples.at(-1) : frame);
      const after = samples[index + 1] ?? (loop ? samples[0] : frame);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!lit(frame, x, y)) continue;
        litPixels++;
        if (!lit(frame, x - 1, y) && !lit(frame, x + 1, y) && !lit(frame, x, y - 1) && !lit(frame, x, y + 1) &&
            !lit(before, x, y) && !lit(after, x, y)) toggles++;
      }
    });
    const rate = litPixels ? toggles / litPixels : 0;
    return { pass: rate <= maxRate, detail: `isolated one-frame shimmer ${(rate * 100).toFixed(2)}% <= ${maxRate * 100}%` };
  } };
}
