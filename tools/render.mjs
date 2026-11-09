import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createFrame, setPixel } from '../src/core/frame.js';
import { encodePNG } from '../src/core/png.js';
import { encodeGIF } from '../src/core/gif.js';
import { drawText } from '../src/core/text.js';
import { loadFX, sampleFX, withoutMathRandom } from '../src/core/run.js';
import { actTimeline, actState } from '../src/core/act.js';
import { examples, isMain, parseArgs, numberOption, resolveFXFile } from './cli.mjs';

const ink = [43, 61, 67, 255];
const muted = [96, 111, 112, 255];
const guide = [88, 130, 137, 65];

function line(frame, x0, y0, x1, y1, color) {
  if (x0 === x1) for (let y = y0; y <= y1; y++) setPixel(frame, x0, y, color);
  else for (let x = x0; x <= x1; x++) setPixel(frame, x, y0, color);
}

function rect(frame, x, y, w, h, color) {
  line(frame, x, y, x + w - 1, y, color);
  line(frame, x, y + h - 1, x + w - 1, y + h - 1, color);
  line(frame, x, y, x, y + h - 1, color);
  line(frame, x + w - 1, y, x + w - 1, y + h - 1, color);
}

export async function renderFX(file, { seed = 1, fps = 30, count = 16, columns = 4, outDir, sheet = false, gif = false, multiAngle = false, palette } = {}) {
  if (!Number.isInteger(count) || count < 2 || count > 256) throw new Error('frames must be an integer from 2 to 256');
  const run = await withoutMathRandom(async () => {
    const fx = await loadFX(file);
    return { ...sampleFX(fx, { seed, fps, ...actTimeline(fx), effectOptions: { palette } }), act: fx.act ?? fx.meta.act };
  });
  const result = await renderRun(run, { count, columns, outDir });
  if (sheet) result.sprite = await exportSheet(run, { columns, outDir });
  if (gif) {
    result.gif = resolve(outDir ?? join('records', run.meta.id), 'preview.gif');
    // The exact terminal duplicate is not a playback frame. Non-loops hold their last frame.
    const frames = run.meta.loop ? run.frames.slice(0, -1) : run.frames;
    await writeFile(result.gif, encodeGIF({ ...run.meta, frames, fps, loop: run.meta.loop }));
  }
  if (multiAngle) {
    const angles = await withoutMathRandom(async () => {
      const fx = await loadFX(file);
      return [-1, 0, 1].flatMap(tiltY => [-1, 0, 1].map(tiltX => {
        const sampled = sampleFX(fx, { seed, fps, effectOptions: { palette, tiltX, tiltY } });
        return { ...sampled.frames[Math.floor((sampled.frames.length - 1) / 2)], tiltX, tiltY };
      }));
    });
    result.angles = await renderRun({ ...run, frames: angles }, { count: 9, columns: 3, outDir, basename: 'multi-angle' });
  }
  return result;
}

export async function exportSheet(run, { columns = 8, outDir } = {}) {
  if (!Number.isInteger(columns) || columns < 1 || columns > 16) throw new Error('columns must be an integer from 1 to 16');
  const { meta } = run;
  // Include complete authored windup/recovery. Loops omit the duplicate terminal pose.
  const samples = meta.loop ? run.frames.slice(0, -1) : run.frames;
  columns = Math.min(columns, samples.length);
  const image = createFrame(meta.w * columns, meta.h * Math.ceil(samples.length / columns));
  const frames = samples.map((sample, index) => {
    const x = index % columns * meta.w, y = Math.floor(index / columns) * meta.h;
    for (let row = 0; row < meta.h; row++) image.data.set(sample.data.subarray(row * meta.w * 4, (row + 1) * meta.w * 4), ((y + row) * image.w + x) * 4);
    return { filename: `${meta.id}/${String(index).padStart(4, '0')}`, frame: { x, y, w: meta.w, h: meta.h },
      rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: meta.w, h: meta.h }, sourceSize: { w: meta.w, h: meta.h },
      time: sample.time, duration: ((samples[index + 1]?.time ?? sample.time + run.dt) - sample.time) * 1000 };
  });
  const output = resolve(outDir ?? join('records', meta.id));
  await mkdir(output, { recursive: true });
  const png = join(output, 'sheet.png'), json = join(output, 'sheet.json');
  const atlas = { frames, meta: { app: 'fx-skill-kit', image: 'sheet.png', format: 'RGBA8888', size: { w: image.w, h: image.h }, scale: '1',
    effect: meta.id, seed: run.seed, fps: run.fps, loop: meta.loop, origin: { x: meta.ox, y: meta.oy }, act: run.act, timeline: run.timeline } };
  await writeFile(png, encodePNG(image));
  await writeFile(json, `${JSON.stringify(atlas, null, 2)}\n`);
  return { png, json, atlas };
}

export async function renderRun(run, { count = run.frames.length, columns = 4, outDir, basename = 'contact' } = {}) {
  if (!Number.isInteger(columns) || columns < 1 || columns > 16) throw new Error('columns must be an integer from 1 to 16');
  const { meta, frames, seed, fps } = run;
  const selectedCount = Math.min(count, frames.length);
  const selected = Array.from({ length: selectedCount }, (_, i) =>
    selectedCount === 1 ? 0 : Math.round(i * (frames.length - 1) / (selectedCount - 1)));
  columns = Math.min(columns, selected.length);
  const cellW = Math.max(192, meta.w + 32);
  const cellH = meta.h + 88;
  const headerH = 64;
  const sheet = createFrame(columns * cellW + 32, Math.ceil(selected.length / columns) * cellH + headerH + 16);
  for (let i = 0; i < sheet.data.length; i += 4) sheet.data.set([248, 244, 237, 255], i);
  drawText(sheet, `FX / ${meta.id.toUpperCase()}`, 24, 16, ink, 2);
  drawText(sheet, `SEED=${seed} / ${frames.length} FRAMES / ${meta.duration}s`, 24, 40, muted);
  selected.forEach((index, cell) => {
    const sample = frames[index];
    const x = 16 + (cell % columns) * cellW;
    const y = headerH + Math.floor(cell / columns) * cellH;
    const fx = x + Math.floor((cellW - meta.w) / 2);
    const fy = y + 26;
    rect(sheet, x + 4, y, cellW - 8, cellH - 8, [214, 216, 207, 255]);
    drawText(sheet, `F${String(index).padStart(3, '0')}  t=${sample.time.toFixed(3)}s`, x + 16, y + 10, ink);
    for (let py = 0; py < meta.h; py++) for (let px = 0; px < meta.w; px++) {
      const offset = (py * meta.w + px) * 4;
      setPixel(sheet, fx + px, fy + py, sample.data.subarray(offset, offset + 4));
    }
    rect(sheet, fx, fy, meta.w, meta.h, [100, 122, 125, 40]);
    if (sample.bounds) {
      const b = sample.bounds;
      rect(sheet, fx + b.x, fy + b.y, b.w, b.h, [125, 152, 140, 80]);
    }
    const inset = Math.max(1, Math.floor(Math.min(meta.w, meta.h) * 0.08));
    rect(sheet, fx + inset, fy + inset, meta.w - inset * 2, meta.h - inset * 2, guide);
    const cx = fx + Math.floor(meta.ox), cy = fy + Math.floor(meta.oy);
    line(sheet, cx - 5, cy, cx + 5, cy, [167, 79, 63, 165]);
    line(sheet, cx, cy - 5, cx, cy + 5, [167, 79, 63, 165]);
    drawText(sheet, `FILL=${(sample.fillRatio * 100).toFixed(2)}%`, x + 16, fy + meta.h + 10, ink);
    drawText(sheet, `OX=${meta.ox} OY=${meta.oy}`, x + 16, fy + meta.h + 24, muted);
    if (sample.tiltX !== undefined) drawText(sheet, `TILT=${sample.tiltX},${sample.tiltY}`, x + 16, fy + meta.h + 36, muted);
    const state = actState(run.act, sample.time, meta.duration);
    if (state.phase) drawText(sheet, state.phase, x + 16, fy + meta.h + 36, muted);
  });
  const output = resolve(outDir ?? join('records', meta.id));
  await mkdir(output, { recursive: true });
  const png = join(output, `${basename}.png`);
  const json = join(output, `${basename}.json`);
  const stats = {
    schemaVersion: 1, meta, act: run.act, timeline: run.timeline, seed, requestedFps: fps, dt: run.dt,
    simulationHz: run.simulationHz, effectOptions: run.effectOptions, hash: run.hash,
    frameCount: frames.length,
    sheet: { w: sheet.w, h: sheet.h, columns, cellW, cellH, headerH, selected },
    frames: frames.map(({ data, ...frame }) => ({ ...frame, ...actState(run.act, frame.time, meta.duration),
      fillPercent: frame.fillRatio * 100, contactCell: selected.includes(frame.index) ? selected.indexOf(frame.index) : null,
    })),
  };
  await writeFile(png, encodePNG(sheet));
  await writeFile(json, `${JSON.stringify(stats, null, 2)}\n`);
  return { png, json, stats };
}

export async function main(args = process.argv.slice(2), { log = console.log } = {}) {
  const { files, options } = parseArgs(args, ['seed', 'fps', 'frames', 'columns', 'out', 'palette'], ['sheet', 'gif', 'multi-angle']);
  if (options.help) {
    log('Usage: npm run render -- [file.js|id ...] [--seed 1] [--fps 30] [--frames 16] [--columns 4] [--out directory] [--sheet] [--gif] [--multi-angle] [--palette name|JSON]');
    return;
  }
  const targets = files.length ? files : examples;
  for (const file of targets) {
    // With multiple inputs, --out is a parent directory; never overwrite another sheet.
    const outDir = options.out && (targets.length === 1 ? options.out : join(options.out, String(targets.indexOf(file))));
    let palette = options.palette;
    if (typeof palette === 'string' && palette.startsWith('[')) {
      try { palette = JSON.parse(palette); }
      catch { throw new Error('Invalid JSON passed to --palette'); }
    }
    const result = await renderFX(await resolveFXFile(file), {
      seed: numberOption(options, 'seed', 1), fps: numberOption(options, 'fps', 30),
      count: numberOption(options, 'frames', 16), columns: numberOption(options, 'columns', 4), outDir,
      sheet: options.sheet, gif: options.gif, multiAngle: options['multi-angle'],
      palette,
    });
    log(`Rendered ${file}\n  ${[result.png, result.json, result.sprite?.png, result.sprite?.json, result.gif, result.angles?.png, result.angles?.json].filter(Boolean).join('\n  ')}`);
  }
}

if (isMain(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
