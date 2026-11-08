import { ditherSample } from './dither.js';
import { paletteColors } from './palette.js';

export const OLED_PROFILES = {
  'ssd1306-128x64': {
    id: 'ssd1306-128x64',
    w: 128,
    h: 64,
    bpp: 1,
    driver: 'SSD1306 / SH1106 (I2C/SPI)',
    frameBytes: 1024,
  },
  'ssd1306-128x32': {
    id: 'ssd1306-128x32',
    w: 128,
    h: 32,
    bpp: 1,
    driver: 'SSD1306 Narrow',
    frameBytes: 512,
  },
  'led-matrix-64x32': {
    id: 'led-matrix-64x32',
    w: 64,
    h: 32,
    bpp: 16,
    driver: 'HUB75 RGB Matrix',
    frameBytes: 4096,
  },
  'st7789-128x128': {
    id: 'st7789-128x128',
    w: 128,
    h: 128,
    bpp: 16,
    driver: 'ST7789 / SSD1351 RGB565',
    frameBytes: 32768,
  },
};

export function createOledScreen(w = 128, h = 64, { dither = 'threshold', safeBorder = true } = {}) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 2 || h < 2) {
    throw new Error('OLED screen dimensions must be integers >= 2');
  }
  const bits = new Uint8Array(w * h);
  const luma = new Float32Array(w * h);

  function setPixel(x, y, val = 1, mode = dither) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    if (safeBorder && (px === 0 || py === 0 || px === w - 1 || py === h - 1)) return;
    const idx = py * w + px;
    const clamped = Math.max(0, Math.min(1, val));
    if (clamped <= 0) {
      bits[idx] = 0;
      luma[idx] = 0;
      return;
    }
    const bit = ditherSample(px, py, clamped, mode);
    bits[idx] = bit;
    luma[idx] = bit ? clamped : 0;
  }

  function getPixel(x, y) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= w || py >= h) return 0;
    return bits[py * w + px];
  }

  function clear(val = 0) {
    const bit = val >= 0.5 ? 1 : 0;
    bits.fill(bit);
    luma.fill(bit ? 1 : 0);
    if (safeBorder && bit) {
      for (let x = 0; x < w; x++) {
        bits[x] = 0; bits[(h - 1) * w + x] = 0;
        luma[x] = 0; luma[(h - 1) * w + x] = 0;
      }
      for (let y = 0; y < h; y++) {
        bits[y * w] = 0; bits[y * w + w - 1] = 0;
        luma[y * w] = 0; luma[y * w + w - 1] = 0;
      }
    }
  }

  function fillRect(x, y, rw, rh, val = 1, mode = dither) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(w, Math.round(x + rw));
    const y1 = Math.min(h, Math.round(y + rh));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) setPixel(px, py, val, mode);
    }
  }

  function strokeRect(x, y, rw, rh, val = 1, mode = dither) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + rw) - 1;
    const y1 = Math.round(y + rh) - 1;
    for (let px = x0; px <= x1; px++) {
      setPixel(px, y0, val, mode);
      setPixel(px, y1, val, mode);
    }
    for (let py = y0; py <= y1; py++) {
      setPixel(x0, py, val, mode);
      setPixel(x1, py, val, mode);
    }
  }

  function fillRoundRect(x, y, rw, rh, r = 4, val = 1, mode = dither) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const width = Math.max(1, Math.round(rw));
    const height = Math.max(1, Math.round(rh));
    const radius = Math.max(0, Math.min(Math.floor(width / 2), Math.floor(height / 2), Math.round(r)));
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        let inside = true;
        if (dx < radius && dy < radius) {
          inside = Math.hypot(radius - dx - 0.5, radius - dy - 0.5) <= radius;
        } else if (dx >= width - radius && dy < radius) {
          inside = Math.hypot(dx - (width - radius) + 0.5, radius - dy - 0.5) <= radius;
        } else if (dx < radius && dy >= height - radius) {
          inside = Math.hypot(radius - dx - 0.5, dy - (height - radius) + 0.5) <= radius;
        } else if (dx >= width - radius && dy >= height - radius) {
          inside = Math.hypot(dx - (width - radius) + 0.5, dy - (height - radius) + 0.5) <= radius;
        }
        if (inside) setPixel(x0 + dx, y0 + dy, val, mode);
      }
    }
  }

  function fillCircle(cx, cy, r, val = 1, mode = dither) {
    if (!(r > 0)) return;
    const rCeil = Math.ceil(r);
    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        if (Math.hypot(dx, dy) <= r) setPixel(cx + dx, cy + dy, val, mode);
      }
    }
  }

  function strokeCircle(cx, cy, r, val = 1, thickness = 1, mode = dither) {
    if (!(r > 0)) return;
    const outer = r + thickness * 0.5;
    const inner = Math.max(0, r - thickness * 0.5);
    const rCeil = Math.ceil(outer);
    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        const d = Math.hypot(dx, dy);
        if (d >= inner && d <= outer) setPixel(cx + dx, cy + dy, val, mode);
      }
    }
  }

  function line(x0, y0, x1, y1, val = 1, thickness = 1, mode = dither) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist * 1.5));
    const rad = Math.max(0, (thickness - 1) * 0.5);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u;
      if (rad <= 0.2) setPixel(x, y, val, mode);
      else fillCircle(x, y, rad, val, mode);
    }
  }

  function arc(cx, cy, r, startAngle, endAngle, val = 1, thickness = 1, mode = dither) {
    const span = Math.abs(endAngle - startAngle);
    const steps = Math.max(4, Math.ceil(r * span * 1.5));
    const rad = Math.max(0, (thickness - 1) * 0.5);
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + (endAngle - startAngle) * (i / steps);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (rad <= 0.2) setPixel(x, y, val, mode);
      else fillCircle(x, y, rad, val, mode);
    }
  }

  // Render the 1-bit screen into the RGBA frame contract.
  // Lit pixels get alpha >= 180 (exact 1-bit mask for packAlphaMask / oledShimmer / oledRLEBudget).
  // Sub-threshold phosphor halo (alpha < 110) provides realistic OLED bloom and multi-level tonal gradient
  // without ever flipping 1-bit hardware masks (which threshold at alpha >= 128).
  function toFrame(rgbaFrame, { palette, dualZone = false } = {}) {
    const [primary, accent = primary] = paletteColors(palette, ['#1e2a2e', '#2c6e7f']);
    const out = rgbaFrame.data;
    out.fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!bits[idx]) continue;
        const outIdx = idx * 4;
        const color = dualZone && y < 16 ? [212, 175, 55] : primary;
        const intensity = Math.max(0.55, Math.min(1, luma[idx] || 1));
        out[outIdx] = color[0];
        out[outIdx + 1] = color[1];
        out[outIdx + 2] = color[2];
        out[outIdx + 3] = Math.round(180 + 75 * intensity);
      }
    }
    // Add subtle sub-128 phosphor glow around lit pixels (never crosses alpha=128 hardware bit threshold)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (bits[idx]) continue;
        const n = bits[idx - 1] + bits[idx + 1] + bits[idx - w] + bits[idx + w];
        if (!n) continue;
        const outIdx = idx * 4;
        out[outIdx] = accent[0];
        out[outIdx + 1] = accent[1];
        out[outIdx + 2] = accent[2];
        out[outIdx + 3] = Math.min(112, n * 26);
      }
    }
  }

  return {
    w,
    h,
    bits,
    luma,
    clear,
    setPixel,
    getPixel,
    fillRect,
    strokeRect,
    fillRoundRect,
    fillCircle,
    strokeCircle,
    line,
    arc,
    toFrame,
  };
}

// Pack a single RGBA or 1-bit frame into SSD1306 vertical pages (1 byte = 8 vertical pixels).
export function packVerticalPages(frame, w = frame.w, h = frame.h) {
  const pages = Math.ceil(h / 8);
  const out = new Uint8Array(w * pages);
  const pixels = frame.data ?? frame;
  for (let y = 0; y < h; y++) {
    const page = Math.floor(y / 8);
    const bit = 1 << (y & 7);
    for (let x = 0; x < w; x++) {
      const lit = frame.bits ? frame.bits[y * w + x] > 0 : pixels[(y * w + x) * 4 + 3] >= 128;
      if (lit) out[page * w + x] |= bit;
    }
  }
  return out;
}

// Encode a byte buffer with PRD 02 Section 2.4 & 2.5 RLE packet rules:
// - High bit (0x80) = 1: repeated byte [0x80 | (count - 1), value], count in 1..128
// - High bit (0x80) = 0: literal run [count - 1, b0, b1, ...], count in 1..128
export function encodeRlePacketStream(bytes) {
  const out = [];
  let pos = 0;
  while (pos < bytes.length) {
    let runEnd = pos + 1;
    while (runEnd < bytes.length && runEnd - pos < 128 && bytes[runEnd] === bytes[pos]) {
      runEnd++;
    }
    if (runEnd - pos >= 2) {
      const count = runEnd - pos;
      out.push(0x80 | (count - 1), bytes[pos]);
      pos = runEnd;
      continue;
    }
    let litEnd = pos + 1;
    while (
      litEnd < bytes.length &&
      litEnd - pos < 128 &&
      !(litEnd + 1 < bytes.length && bytes[litEnd] === bytes[litEnd + 1])
    ) {
      litEnd++;
    }
    const count = litEnd - pos;
    out.push(count - 1);
    for (let i = pos; i < litEnd; i++) out.push(bytes[i]);
    pos = litEnd;
  }
  return Uint8Array.from(out);
}

// Encode frames using Frame 0 Keyframe + Frame 1..N XOR-Delta + RLE.
export function encodeXorRle(frames, w, h) {
  if (!frames?.length) throw new Error('encodeXorRle requires at least one frame');
  const stride = w * Math.ceil(h / 8);
  const chunks = [];
  const offsets = [];
  let totalBytes = 0;
  let previous = new Uint8Array(stride);

  for (let i = 0; i < frames.length; i++) {
    const current = packVerticalPages(frames[i], w, h);
    const delta = new Uint8Array(stride);
    for (let b = 0; b < stride; b++) {
      delta[b] = i === 0 ? current[b] : (current[b] ^ previous[b]);
    }
    const packet = encodeRlePacketStream(delta);
    offsets.push(totalBytes);
    chunks.push(packet);
    totalBytes += packet.length;
    previous = current;
  }

  const data = new Uint8Array(totalBytes);
  let cursor = 0;
  for (const chunk of chunks) {
    data.set(chunk, cursor);
    cursor += chunk.length;
  }

  return {
    data,
    offsets,
    stride,
    rawBytes: stride * frames.length,
    compressedBytes: data.length + offsets.length * 2,
  };
}

// Reference JS mirror of the zero-malloc C decoder `oledfx_step_frame` in PRD 02 Section 2.5.
export function decodeXorRleStep(fb, data, offsets, frameIdx, stride = fb.length) {
  let pos = offsets[frameIdx];
  let out = 0;
  if (frameIdx === 0) fb.fill(0);
  while (out < stride) {
    const header = data[pos++];
    if (header & 0x80) {
      let count = (header & 0x7f) + 1;
      const val = data[pos++];
      if (val === 0) {
        out += count;
      } else {
        while (count-- && out < stride) fb[out++] ^= val;
      }
    } else {
      let count = header + 1;
      while (count-- && out < stride) fb[out++] ^= data[pos++];
    }
  }
  return fb;
}

export function formatMcuHeader({ id, profile = 'ssd1306-128x64', w = 128, h = 64, fps = 24, frames }) {
  const symbol = `FX_${String(id).replaceAll(/[^a-z0-9]/gi, '_').toUpperCase()}`;
  const encoded = encodeXorRle(frames, w, h);
  const rows = [];
  for (let i = 0; i < encoded.data.length; i += 16) {
    const slice = Array.from(encoded.data.subarray(i, i + 16), b => `0x${b.toString(16).padStart(2, '0')}`);
    rows.push(`  ${slice.join(', ')},`);
  }
  const offsetItems = encoded.offsets.map(n => String(n)).join(', ');
  const offsetType = encoded.data.length > 65535 ? 'uint32_t' : 'uint16_t';
  const readOffset = encoded.data.length > 65535 ? 'pgm_read_dword' : 'pgm_read_word';

  return `// Auto-generated by oledfx export-mcu.mjs | Profile: ${profile} | FPS: ${fps} | Size: ${encoded.compressedBytes} bytes
#pragma once
#include <stdint.h>
#ifdef ARDUINO
  #include <pgmspace.h>
#else
  #ifndef PROGMEM
  #define PROGMEM
  #endif
  #ifndef pgm_read_byte
  #define pgm_read_byte(addr) (*(const uint8_t *)(addr))
  #endif
  #ifndef pgm_read_word
  #define pgm_read_word(addr) (*(const uint16_t *)(addr))
  #endif
  #ifndef pgm_read_dword
  #define pgm_read_dword(addr) (*(const uint32_t *)(addr))
  #endif
#endif

#define ${symbol}_W ${w}
#define ${symbol}_H ${h}
#define ${symbol}_FRAMES ${frames.length}
#define ${symbol}_FPS ${fps}
#define ${symbol}_FRAME_BYTES ${encoded.stride}

// High bit (0x80) = 1: repeated byte [0x80 | (count - 1), value]; otherwise literal [count - 1, b0, b1...]
static const uint8_t ${symbol}_DATA[] PROGMEM = {
${rows.join('\n')}
};
static const ${offsetType} ${symbol}_OFFSETS[${frames.length}] PROGMEM = { ${offsetItems} };

// Zero-malloc decoder: applies XOR delta directly onto the ${encoded.stride}-byte display buffer.
static inline void oledfx_step_frame(uint8_t *fb_${encoded.stride}, uint16_t frame_idx) {
  ${offsetType} pos = ${readOffset}(&${symbol}_OFFSETS[frame_idx]);
  uint16_t out = 0;
  if (frame_idx == 0) {
    for (uint16_t i = 0; i < ${encoded.stride}; i++) fb_${encoded.stride}[i] = 0;
  }
  while (out < ${encoded.stride}) {
    uint8_t header = pgm_read_byte(&${symbol}_DATA[pos++]);
    if (header & 0x80) {
      uint8_t count = (header & 0x7F) + 1;
      uint8_t val = pgm_read_byte(&${symbol}_DATA[pos++]);
      if (val == 0) { out += count; }
      else { while (count-- && out < ${encoded.stride}) fb_${encoded.stride}[out++] ^= val; }
    } else {
      uint8_t count = header + 1;
      while (count-- && out < ${encoded.stride}) fb_${encoded.stride}[out++] ^= pgm_read_byte(&${symbol}_DATA[pos++]);
    }
  }
}
`;
}

// Mode B compatibility: U8g2 XBM (LSB-first horizontal row bytes) or Adafruit GFX (MSB-first horizontal row bytes).
export function formatBitmapHeader({ id, profile = 'ssd1306-128x64', w = 128, h = 64, fps = 24, frames, mode = 'xbm' }) {
  const symbol = `FX_${String(id).replaceAll(/[^a-z0-9]/gi, '_').toUpperCase()}`;
  const rowBytes = Math.ceil(w / 8);
  const frameStride = rowBytes * h;
  const bytes = new Uint8Array(frameStride * frames.length);

  frames.forEach((frame, fi) => {
    const pixels = frame.data ?? frame;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const lit = frame.bits ? frame.bits[y * w + x] > 0 : pixels[(y * w + x) * 4 + 3] >= 128;
        if (!lit) continue;
        const byteIdx = fi * frameStride + y * rowBytes + Math.floor(x / 8);
        const bit = mode === 'xbm' ? (1 << (x & 7)) : (0x80 >> (x & 7));
        bytes[byteIdx] |= bit;
      }
    }
  });

  const rows = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = Array.from(bytes.subarray(i, i + 16), b => `0x${b.toString(16).padStart(2, '0')}`);
    rows.push(`  ${slice.join(', ')},`);
  }

  return `// Auto-generated by oledfx export-mcu.mjs | Format: ${mode.toUpperCase()} | Profile: ${profile} | FPS: ${fps}
#pragma once
#include <stdint.h>
#ifdef ARDUINO
  #include <pgmspace.h>
#else
  #ifndef PROGMEM
  #define PROGMEM
  #endif
#endif

#define ${symbol}_W ${w}
#define ${symbol}_H ${h}
#define ${symbol}_FRAMES ${frames.length}
#define ${symbol}_FPS ${fps}
#define ${symbol}_FRAME_BYTES ${frameStride}

static const uint8_t ${symbol}_BITMAPS[${bytes.length}] PROGMEM = {
${rows.join('\n')}
};
`;
}

// Convert 8-bit straight RGBA into 16-bit RGB565 (premultiplied against dark OLED/TFT background).
export function rgbaToRgb565(r, g, b, a = 255) {
  const alpha = Math.max(0, Math.min(255, a)) / 255;
  const r8 = Math.round(r * alpha);
  const g8 = Math.round(g * alpha);
  const b8 = Math.round(b * alpha);
  return ((r8 >> 3) << 11) | ((g8 >> 2) << 5) | (b8 >> 3);
}

export function packRgb565Frame(frame, w = frame.w, h = frame.h) {
  const out = new Uint16Array(w * h);
  const pixels = frame.data ?? frame;
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    out[i] = rgbaToRgb565(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]);
  }
  return out;
}

export function encodeRgb565PacketStream(words) {
  const out = [];
  let pos = 0;
  while (pos < words.length) {
    let runEnd = pos + 1;
    while (runEnd < words.length && runEnd - pos < 32768 && words[runEnd] === words[pos]) {
      runEnd++;
    }
    if (runEnd - pos >= 2) {
      out.push(0x8000 | (runEnd - pos - 1), words[pos]);
      pos = runEnd;
      continue;
    }
    let litEnd = pos + 1;
    while (
      litEnd < words.length &&
      litEnd - pos < 32768 &&
      !(litEnd + 1 < words.length && words[litEnd] === words[litEnd + 1])
    ) {
      litEnd++;
    }
    out.push(litEnd - pos - 1);
    for (let i = pos; i < litEnd; i++) out.push(words[i]);
    pos = litEnd;
  }
  return Uint16Array.from(out);
}

export function encodeRgb565XorRle(frames, w, h) {
  if (!frames?.length) throw new Error('encodeRgb565XorRle requires at least one frame');
  const pixelsPerFrame = w * h;
  const chunks = [];
  const offsets = [];
  let totalWords = 0;
  let previous = new Uint16Array(pixelsPerFrame);

  for (let i = 0; i < frames.length; i++) {
    const current = packRgb565Frame(frames[i], w, h);
    const delta = new Uint16Array(pixelsPerFrame);
    for (let p = 0; p < pixelsPerFrame; p++) {
      delta[p] = i === 0 ? current[p] : (current[p] ^ previous[p]);
    }
    const packet = encodeRgb565PacketStream(delta);
    offsets.push(totalWords);
    chunks.push(packet);
    totalWords += packet.length;
    previous = current;
  }

  const data = new Uint16Array(totalWords);
  let cursor = 0;
  for (const chunk of chunks) {
    data.set(chunk, cursor);
    cursor += chunk.length;
  }

  return {
    data,
    offsets,
    pixelsPerFrame,
    rawBytes: pixelsPerFrame * 2 * frames.length,
    compressedBytes: data.length * 2 + offsets.length * 4,
  };
}

export function decodeRgb565XorRleStep(fb16, data, offsets, frameIdx, pixelsPerFrame = fb16.length) {
  let pos = offsets[frameIdx];
  let out = 0;
  if (frameIdx === 0) fb16.fill(0);
  while (out < pixelsPerFrame) {
    const header = data[pos++];
    if (header & 0x8000) {
      let count = (header & 0x7fff) + 1;
      const val = data[pos++];
      if (val === 0) {
        out += count;
      } else {
        while (count-- && out < pixelsPerFrame) fb16[out++] ^= val;
      }
    } else {
      let count = header + 1;
      while (count-- && out < pixelsPerFrame) fb16[out++] ^= data[pos++];
    }
  }
  return fb16;
}

export function formatRgb565Header({ id, profile = 'st7789-128x128', w = 128, h = 128, fps = 24, frames, rle = true }) {
  const symbol = `FX_${String(id).replaceAll(/[^a-z0-9]/gi, '_').toUpperCase()}`;
  const pixelsPerFrame = w * h;
  if (!rle) {
    const all = new Uint16Array(pixelsPerFrame * frames.length);
    frames.forEach((f, fi) => all.set(packRgb565Frame(f, w, h), fi * pixelsPerFrame));
    const rows = [];
    for (let i = 0; i < all.length; i += 12) {
      const slice = Array.from(all.subarray(i, i + 12), v => `0x${v.toString(16).padStart(4, '0')}`);
      rows.push(`  ${slice.join(', ')},`);
    }
    return `// Auto-generated by oledfx export-mcu.mjs | Format: RGB565 Raw | Profile: ${profile} | FPS: ${fps} | Size: ${all.byteLength} bytes
#pragma once
#include <stdint.h>
#ifdef ARDUINO
  #include <pgmspace.h>
#else
  #ifndef PROGMEM
  #define PROGMEM
  #endif
#endif

#define ${symbol}_W ${w}
#define ${symbol}_H ${h}
#define ${symbol}_FRAMES ${frames.length}
#define ${symbol}_FPS ${fps}
#define ${symbol}_PIXELS ${pixelsPerFrame}

static const uint16_t ${symbol}_RGB565[${all.length}] PROGMEM = {
${rows.join('\n')}
};
`;
  }

  const encoded = encodeRgb565XorRle(frames, w, h);
  const rows = [];
  for (let i = 0; i < encoded.data.length; i += 12) {
    const slice = Array.from(encoded.data.subarray(i, i + 12), v => `0x${v.toString(16).padStart(4, '0')}`);
    rows.push(`  ${slice.join(', ')},`);
  }
  const offsetItems = encoded.offsets.map(n => String(n)).join(', ');

  return `// Auto-generated by oledfx export-mcu.mjs | Format: RGB565 XOR-RLE | Profile: ${profile} | FPS: ${fps} | Size: ${encoded.compressedBytes} bytes
#pragma once
#include <stdint.h>
#ifdef ARDUINO
  #include <pgmspace.h>
#else
  #ifndef PROGMEM
  #define PROGMEM
  #endif
  #ifndef pgm_read_word
  #define pgm_read_word(addr) (*(const uint16_t *)(addr))
  #endif
  #ifndef pgm_read_dword
  #define pgm_read_dword(addr) (*(const uint32_t *)(addr))
  #endif
#endif

#define ${symbol}_W ${w}
#define ${symbol}_H ${h}
#define ${symbol}_FRAMES ${frames.length}
#define ${symbol}_FPS ${fps}
#define ${symbol}_PIXELS ${pixelsPerFrame}

static const uint16_t ${symbol}_RGB565_DATA[] PROGMEM = {
${rows.join('\n')}
};
static const uint32_t ${symbol}_RGB565_OFFSETS[${frames.length}] PROGMEM = { ${offsetItems} };

// Zero-malloc RGB565 XOR-RLE decoder for ST7789 / SSD1351 / HUB75 16-bit framebuffers.
static inline void oledfx_step_rgb565(uint16_t *fb_px, uint16_t frame_idx) {
  uint32_t pos = pgm_read_dword(&${symbol}_RGB565_OFFSETS[frame_idx]);
  uint32_t out = 0;
  if (frame_idx == 0) {
    for (uint32_t i = 0; i < ${pixelsPerFrame}u; i++) fb_px[i] = 0;
  }
  while (out < ${pixelsPerFrame}u) {
    uint16_t header = pgm_read_word(&${symbol}_RGB565_DATA[pos++]);
    if (header & 0x8000u) {
      uint32_t count = (uint32_t)(header & 0x7FFFu) + 1u;
      uint16_t val = pgm_read_word(&${symbol}_RGB565_DATA[pos++]);
      if (val == 0u) { out += count; }
      else { while (count-- && out < ${pixelsPerFrame}u) fb_px[out++] ^= val; }
    } else {
      uint32_t count = (uint32_t)header + 1u;
      while (count-- && out < ${pixelsPerFrame}u) fb_px[out++] ^= pgm_read_word(&${symbol}_RGB565_DATA[pos++]);
    }
  }
}
`;
}

