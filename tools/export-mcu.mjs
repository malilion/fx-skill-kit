import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { loadFX, sampleFX, withoutMathRandom } from '../src/core/run.js';
import { formatCHeader } from '../src/core/mask.js';
import {
  OLED_PROFILES,
  encodeXorRle,
  formatMcuHeader,
  formatBitmapHeader,
  encodeRgb565XorRle,
  formatRgb565Header,
} from '../src/core/oled.js';
import { isMain, numberOption, parseArgs, resolveFXFile } from './cli.mjs';

function fitFrameToProfile(frame, srcW, srcH, dstW, dstH) {
  if (srcW === dstW && srcH === dstH) return frame;
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const scaledW = Math.round(srcW * scale);
  const scaledH = Math.round(srcH * scale);
  const offsetX = Math.floor((dstW - scaledW) / 2);
  const offsetY = Math.floor((dstH - scaledH) / 2);
  for (let y = 0; y < scaledH; y++) {
    const sy = Math.min(srcH - 1, Math.floor(y / scale));
    for (let x = 0; x < scaledW; x++) {
      const sx = Math.min(srcW - 1, Math.floor(x / scale));
      const srcIdx = (sy * srcW + sx) * 4;
      const dstIdx = ((offsetY + y) * dstW + (offsetX + x)) * 4;
      out[dstIdx] = frame.data[srcIdx];
      out[dstIdx + 1] = frame.data[srcIdx + 1];
      out[dstIdx + 2] = frame.data[srcIdx + 2];
      out[dstIdx + 3] = frame.data[srcIdx + 3];
    }
  }
  return { w: dstW, h: dstH, data: out };
}

export async function exportMcuHeader(file, {
  profile = 'ssd1306-128x64',
  fps = 24,
  compress = 'xor-rle',
  seed = 42,
  out,
} = {}) {
  const spec = OLED_PROFILES[profile];
  if (!spec) {
    throw new Error(`Unknown profile: ${profile}. Available: ${Object.keys(OLED_PROFILES).join(', ')}`);
  }
  if (!['xor-rle', 'xbm', 'adafruit', 'raw', 'rgb565', 'rgb565-rle'].includes(compress)) {
    throw new Error('compress must be xor-rle, xbm, adafruit, raw, rgb565, or rgb565-rle');
  }

  const run = await withoutMathRandom(async () => {
    const fx = await loadFX(file);
    return sampleFX(fx, { seed, fps });
  });

  const { id, w, h, loop } = run.meta;
  const rawSamples = loop ? run.frames.slice(0, -1) : run.frames;
  const frames = rawSamples.map(sample => fitFrameToProfile(sample, w, h, spec.w, spec.h));

  let header;
  let stats;
  const isRgb565 = spec.bpp === 16 || compress === 'rgb565' || compress === 'rgb565-rle';
  if (isRgb565) {
    const useRle = compress === 'xor-rle' || compress === 'rgb565-rle';
    const encoded = encodeRgb565XorRle(frames, spec.w, spec.h);
    header = formatRgb565Header({ id, profile, w: spec.w, h: spec.h, fps, frames, rle: useRle });
    const compressedBytes = useRle ? encoded.compressedBytes : encoded.rawBytes;
    stats = {
      rawBytes: encoded.rawBytes,
      compressedBytes,
      ratio: 1 - compressedBytes / encoded.rawBytes,
      frames: frames.length,
    };
  } else if (compress === 'xor-rle') {
    const encoded = encodeXorRle(frames, spec.w, spec.h);
    header = formatMcuHeader({ id, profile, w: spec.w, h: spec.h, fps, frames });
    stats = {
      rawBytes: encoded.rawBytes,
      compressedBytes: encoded.compressedBytes,
      ratio: 1 - encoded.compressedBytes / encoded.rawBytes,
      frames: frames.length,
    };
  } else if (compress === 'xbm' || compress === 'adafruit') {
    header = formatBitmapHeader({ id, profile, w: spec.w, h: spec.h, fps, frames, mode: compress });
    const bytes = Math.ceil(spec.w / 8) * spec.h * frames.length;
    stats = { rawBytes: bytes, compressedBytes: bytes, ratio: 0, frames: frames.length };
  } else {
    header = formatCHeader({ id, w: spec.w, h: spec.h, frames, dt: run.dt, seed });
    const bytes = spec.w * Math.ceil(spec.h / 8) * frames.length;
    stats = { rawBytes: bytes, compressedBytes: bytes, ratio: 0, frames: frames.length };
  }

  const slug = String(id).split('/').pop().replaceAll('-', '_');
  const outPath = out
    ? (out.endsWith('.h') ? resolve(out) : resolve(out, `fx_${slug}.h`))
    : resolve('records', id, `fx_${slug}.h`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, header);

  return {
    file: outPath,
    profile,
    compress,
    fps,
    width: spec.w,
    height: spec.h,
    ...stats,
  };
}

export async function main(args = process.argv.slice(2), { log = console.log } = {}) {
  const { files, options } = parseArgs(args, ['profile', 'fps', 'compress', 'seed', 'out']);
  if (options.help || !files.length) {
    log('Usage: node tools/export-mcu.mjs <id|file.js> [--profile ssd1306-128x64] [--fps 24] [--compress xor-rle|xbm|adafruit|raw] [--seed 42] [--out ./firmware/include/fx_name.h]');
    if (!options.help && !files.length) throw new Error('Provide an FX id or file path');
    return;
  }
  for (const input of files) {
    const file = await resolveFXFile(input);
    const result = await exportMcuHeader(file, {
      profile: options.profile ?? 'ssd1306-128x64',
      fps: numberOption(options, 'fps', 24),
      compress: options.compress ?? 'xor-rle',
      seed: numberOption(options, 'seed', 42),
      out: options.out,
    });
    log(`Exported MCU header for ${input} (${result.profile}, ${result.compress}, ${result.compressedBytes} bytes / raw ${result.rawBytes} bytes)\n  ${result.file}`);
  }
}

if (isMain(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
