// Browser-safe PNG. Stored zlib blocks keep the encoder free of Node builtins.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function storedZlib(bytes) {
  const chunks = [0x78, 0x01];
  for (let offset = 0; offset < bytes.length || offset === 0; offset += 65535) {
    const remaining = bytes.length - offset;
    const len = Math.max(0, Math.min(65535, remaining));
    const last = offset + len >= bytes.length;
    const nlen = (~len) & 0xffff;
    chunks.push(last ? 1 : 0, len & 255, len >> 8, nlen & 255, nlen >> 8);
    for (let i = 0; i < len; i++) chunks.push(bytes[offset + i]);
    if (bytes.length === 0) break;
  }
  const sum = adler32(bytes);
  chunks.push(sum >>> 24, (sum >>> 16) & 255, (sum >>> 8) & 255, sum & 255);
  return new Uint8Array(chunks);
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

export function encodeFramePNG({ w, h, data }) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || data.length !== w * h * 4) {
    throw new Error('Invalid RGBA frame');
  }
  const scanlines = new Uint8Array(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) scanlines.set(data.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, w);
  view.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', storedZlib(scanlines)),
    chunk('IEND', new Uint8Array()),
  ]);
}
