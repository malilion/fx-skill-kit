// GIF89a preview encoder: fixed 6x6x6 palette, transparent index 0.
// Literal LZW with a clear every 200 pixels keeps codes at 9 bits: simple,
// bounded memory, valid GIF, trading compression ratio for zero dependencies.
export function encodeGIF({ w, h, frames, fps = 30, loop = false, background = [248, 244, 237] }) {
  if (![w, h].every(n => Number.isInteger(n) && n > 0 && n <= 65535) || !frames.length ||
      !Number.isFinite(fps) || fps <= 0 || frames.some(f => f.data.length !== w * h * 4)) {
    throw new Error('Invalid GIF frames or timing');
  }
  const word = n => Buffer.from([n & 255, (n >> 8) & 255]);
  const palette = Buffer.alloc(768);
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) {
    palette.set([r * 51, g * 51, b * 51], (1 + r * 36 + g * 6 + b) * 3);
  }
  const chunks = [Buffer.from('GIF89a'), word(w), word(h), Buffer.from([0xf7, 0, 0]), palette];
  if (loop) chunks.push(Buffer.from([0x21, 0xff, 11]), Buffer.from('NETSCAPE2.0'), Buffer.from([3, 1, 0, 0, 0]));
  let elapsed = 0;
  for (let fi = 0; fi < frames.length; fi++) {
    const frame = frames[fi];
    // Cumulative rounding avoids drift at 12/24/30/60fps (GIF uses centiseconds).
    const seconds = fi + 1 < frames.length && Number.isFinite(frame.time) && Number.isFinite(frames[fi + 1].time)
      ? frames[fi + 1].time - frame.time : 1 / fps;
    const next = elapsed + seconds * 100;
    const delay = Math.max(1, Math.round(next) - Math.round(elapsed)); elapsed = next;
    chunks.push(Buffer.from([0x21, 0xf9, 4, 9]), word(delay), Buffer.from([0, 0, 0x2c]),
      word(0), word(0), word(w), word(h), Buffer.from([0, 8]));
    const bytes = [];
    let bits = 0, bitCount = 0;
    const code = value => {
      bits |= value << bitCount; bitCount += 9;
      while (bitCount >= 8) { bytes.push(bits & 255); bits >>>= 8; bitCount -= 8; }
    };
    for (let p = 0; p < w * h; p++) {
      if (p % 200 === 0) code(256);
      const i = p * 4, alpha = frame.data[i + 3] / 255;
      if (!alpha) { code(0); continue; }
      const rgb = background.map((bg, c) => Math.max(0, Math.min(5, Math.round((frame.data[i + c] * alpha + bg * (1 - alpha)) / 51))));
      code(1 + rgb[0] * 36 + rgb[1] * 6 + rgb[2]);
    }
    code(257);
    if (bitCount) bytes.push(bits & 255);
    const data = Buffer.from(bytes);
    for (let i = 0; i < data.length; i += 255) chunks.push(Buffer.from([Math.min(255, data.length - i)]), data.subarray(i, i + 255));
    chunks.push(Buffer.from([0]));
  }
  chunks.push(Buffer.from([0x3b]));
  return Buffer.concat(chunks);
}
