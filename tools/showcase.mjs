import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createFrame } from '../src/core/frame.js';
import { encodeGIF } from '../src/core/gif.js';
import { encodePNG } from '../src/core/png.js';
import { loadFX, withoutMathRandom } from '../src/core/run.js';
import { isMain, numberOption, parseArgs, resolveFXFile } from './cli.mjs';

export const DEFAULT_SHOWCASE_IDS = [
  // Row 1-2: 12 InkFX (Xuan-paper Eastern Ink & Wuxia)
  'sword/sword-qi-slash',
  'sword/cross-cleave',
  'sword/myriad-swords',
  'talisman/bagua-seal',
  'talisman/cinnabar-burn',
  'talisman/ink-chains',
  'zen/bamboo-wind',
  'zen/plum-blossom',
  'zen/falling-sakura',
  'ink-burst/heavy-impact',
  'ink-burst/qi-surge',
  'ui/realm-breakthrough',
  // Row 3-4: 12 OLEDFX (128x64 Embedded Hardware Simulator)
  'eyes/happy-squint',
  'eyes/curious-blink',
  'eyes/cyber-charge',
  'eyes/dizzy-spiral',
  'weather/rain-storm',
  'weather/sunny-orbit',
  'weather/snow-drift',
  'system/wifi-pulse',
  'system/battery-charge',
  'system/cpu-wave',
  'pomodoro/hot-coffee',
  'transitions/crt-off',
];

function fillRectRgb(buf, canvasW, x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h; y++) {
    const row = y * canvasW;
    for (let x = x0; x < x0 + w; x++) {
      const i = (row + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }
}

function strokeRectRgb(buf, canvasW, x0, y0, w, h, r, g, b) {
  for (let x = x0; x < x0 + w; x++) {
    const top = (y0 * canvasW + x) * 4;
    const bot = ((y0 + h - 1) * canvasW + x) * 4;
    buf[top] = r; buf[top + 1] = g; buf[top + 2] = b; buf[top + 3] = 255;
    buf[bot] = r; buf[bot + 1] = g; buf[bot + 2] = b; buf[bot + 3] = 255;
  }
  for (let y = y0; y < y0 + h; y++) {
    const left = (y * canvasW + x0) * 4;
    const right = (y * canvasW + (x0 + w - 1)) * 4;
    buf[left] = r; buf[left + 1] = g; buf[left + 2] = b; buf[left + 3] = 255;
    buf[right] = r; buf[right + 1] = g; buf[right + 2] = b; buf[right + 3] = 255;
  }
}

function blitScaled(dst, dstW, cellX, cellY, cellW, cellH, srcFrame, cropMargin = 0) {
  const { w: srcW, h: srcH, data: src } = srcFrame;
  const pad = 3;
  const innerW = cellW - pad * 2;
  const innerH = cellH - pad * 2;
  const effW = Math.max(16, srcW - cropMargin * 2);
  const effH = Math.max(16, srcH - cropMargin * 2);
  const scale = Math.min(innerW / effW, innerH / effH);
  const drawW = Math.round(effW * scale);
  const drawH = Math.round(effH * scale);
  const offX = cellX + Math.floor((cellW - drawW) / 2);
  const offY = cellY + Math.floor((cellH - drawH) / 2);

  for (let y = 0; y < drawH; y++) {
    const sy = Math.min(srcH - 1, cropMargin + Math.floor(y / scale));
    const dstRow = (offY + y) * dstW;
    const srcRow = sy * srcW;
    for (let x = 0; x < drawW; x++) {
      const sx = Math.min(srcW - 1, cropMargin + Math.floor(x / scale));
      const si = (srcRow + sx) * 4;
      const sa = src[si + 3] / 255;
      if (sa <= 0.01) continue;
      const di = (dstRow + offX + x) * 4;
      dst[di] = Math.round(src[si] * sa + dst[di] * (1 - sa));
      dst[di + 1] = Math.round(src[si + 1] * sa + dst[di + 1] * (1 - sa));
      dst[di + 2] = Math.round(src[si + 2] * sa + dst[di + 2] * (1 - sa));
      dst[di + 3] = 255;
    }
  }
}

export async function renderShowcaseGrid({
  ids = DEFAULT_SHOWCASE_IDS,
  cols = 6,
  rows = 4,
  cellW = 88,
  cellH = 56,
  gap = 5,
  margin = 8,
  frameCount = 16,
  fps = 12,
  seed = 42,
  outGif = 'records/showcase-grid.gif',
  outPng = 'records/showcase-grid.png',
} = {}) {
  const selectedIds = ids.slice(0, cols * rows);
  const loaded = await withoutMathRandom(async () => {
    const items = [];
    for (const id of selectedIds) {
      const file = await resolveFXFile(id);
      const fx = await loadFX(file);
      items.push(fx);
    }
    return items;
  });

  const canvasW = margin * 2 + cols * cellW + (cols - 1) * gap;
  const canvasH = margin * 2 + rows * cellH + (rows - 1) * gap;
  const gridFrames = [];

  await withoutMathRandom(async () => {
    for (let fi = 0; fi < frameCount; fi++) {
      const u = fi / frameCount;
      const grid = createFrame(canvasW, canvasH);
      // Outer gallery backdrop
      fillRectRgb(grid.data, canvasW, 0, 0, canvasW, canvasH, 24, 22, 20);

      for (let idx = 0; idx < loaded.length; idx++) {
        const fx = loaded[idx];
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = margin + col * (cellW + gap);
        const cy = margin + row * (cellH + gap);
        const isOled = Boolean(fx.meta.profile);

        if (isOled) {
          fillRectRgb(grid.data, canvasW, cx, cy, cellW, cellH, 6, 12, 16);
          strokeRectRgb(grid.data, canvasW, cx, cy, cellW, cellH, 32, 68, 82);
        } else {
          fillRectRgb(grid.data, canvasW, cx, cy, cellW, cellH, 245, 240, 230);
          strokeRectRgb(grid.data, canvasW, cx, cy, cellW, cellH, 204, 194, 178);
        }

        const inst = fx.create({
          seed: seed + idx,
          dualZone: isOled && idx % 2 === 0,
          palette: isOled ? ['#36f3ff', '#1696b8'] : undefined,
        });
        const targetTime = fx.meta.loop
          ? u * fx.meta.duration
          : (0.08 + u * 0.82) * fx.meta.duration;
        const steps = 12;
        const dt = targetTime / steps;
        for (let s = 0; s < steps; s++) inst.step(dt);
        const cellFrame = createFrame(fx.meta.w, fx.meta.h, fx.meta.ox, fx.meta.oy);
        inst.draw(cellFrame);
        blitScaled(grid.data, canvasW, cx, cy, cellW, cellH, cellFrame, isOled ? 0 : 20);
      }

      grid.time = fi / fps;
      gridFrames.push(grid);
    }
  });

  const gifPath = resolve(outGif);
  const pngPath = resolve(outPng);
  await mkdir(dirname(gifPath), { recursive: true });
  await mkdir(dirname(pngPath), { recursive: true });

  const gifBuffer = encodeGIF({
    w: canvasW,
    h: canvasH,
    frames: gridFrames,
    fps,
    loop: true,
    background: [24, 22, 20],
  });
  await writeFile(gifPath, gifBuffer);

  // Use middle peak-action frame as static poster PNG
  const posterIdx = Math.floor(gridFrames.length * 0.45);
  const pngBuffer = encodePNG(gridFrames[posterIdx]);
  await writeFile(pngPath, pngBuffer);

  return {
    gif: gifPath,
    png: pngPath,
    width: canvasW,
    height: canvasH,
    cells: loaded.length,
    frames: gridFrames.length,
    gifBytes: gifBuffer.length,
  };
}

export async function main(args = process.argv.slice(2), { log = console.log } = {}) {
  const { options } = parseArgs(args, ['fps', 'frames', 'seed', 'out-gif', 'out-png']);
  if (options.help) {
    log('Usage: node tools/showcase.mjs [--fps 12] [--frames 16] [--seed 42] [--out-gif records/showcase-grid.gif] [--out-png records/showcase-grid.png]');
    return;
  }
  const res = await renderShowcaseGrid({
    fps: numberOption(options, 'fps', 12),
    frameCount: numberOption(options, 'frames', 16),
    seed: numberOption(options, 'seed', 42),
    outGif: options['out-gif'] ?? 'records/showcase-grid.gif',
    outPng: options['out-png'] ?? 'records/showcase-grid.png',
  });
  log(`Generated 6x4 showcase grid (${res.width}x${res.height}, ${res.cells} effects, ${res.frames} frames)\n  GIF: ${res.gif} (${res.gifBytes} bytes)\n  PNG: ${res.png}`);
}

if (isMain(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
