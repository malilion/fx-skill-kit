import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createFrame } from '../src/core/frame.js';
import { encodePNG } from '../src/core/png.js';
import { mineralRampColors, mineralRamps } from '../src/core/palette.js';
import { paperGrainMap } from '../src/core/seed.js';
import { loadFX, sampleFX, withoutMathRandom } from '../src/core/run.js';
import { actTimeline, actState } from '../src/core/act.js';
import { isMain, numberOption, parseArgs, resolveFXFile } from './cli.mjs';

function compositePaper(sample, meta, seed, palette) {
  const [paper] = mineralRampColors(palette, meta.defaultPalette ?? mineralRamps.songyan);
  const grain = paperGrainMap(meta.w, meta.h, seed, 5);
  const out = new Uint8ClampedArray(sample.data.length);
  for (let i = 0; i < meta.w * meta.h; i++) {
    const idx = i * 4;
    const sa = sample.data[idx + 3] / 255;
    const gShift = (grain[i] - 0.5) * 8;
    const pr = Math.max(0, Math.min(255, paper[0] + gShift));
    const pg = Math.max(0, Math.min(255, paper[1] + gShift));
    const pb = Math.max(0, Math.min(255, paper[2] + gShift));
    out[idx] = Math.round(sample.data[idx] * sa + pr * (1 - sa));
    out[idx + 1] = Math.round(sample.data[idx + 1] * sa + pg * (1 - sa));
    out[idx + 2] = Math.round(sample.data[idx + 2] * sa + pb * (1 - sa));
    out[idx + 3] = 255;
  }
  return out;
}

export async function exportInkSheet(file, {
  seed = 42,
  fps = 30,
  columns = 8,
  palette,
  paper = false,
  outDir,
} = {}) {
  if (!Number.isInteger(columns) || columns < 1 || columns > 16) {
    throw new Error('columns must be an integer from 1 to 16');
  }
  const run = await withoutMathRandom(async () => {
    const fx = await loadFX(file);
    return {
      ...sampleFX(fx, { seed, fps, ...actTimeline(fx), effectOptions: { palette } }),
      act: fx.act ?? fx.meta.act ?? null,
    };
  });

  const { meta } = run;
  const samples = meta.loop ? run.frames.slice(0, -1) : run.frames;
  const cols = Math.min(columns, samples.length);
  const rows = Math.ceil(samples.length / cols);
  const image = createFrame(meta.w * cols, meta.h * rows);

  const frames = samples.map((sample, index) => {
    const x = (index % cols) * meta.w;
    const y = Math.floor(index / cols) * meta.h;
    const pixels = paper ? compositePaper(sample, meta, seed, palette) : sample.data;
    for (let row = 0; row < meta.h; row++) {
      image.data.set(
        pixels.subarray(row * meta.w * 4, (row + 1) * meta.w * 4),
        ((y + row) * image.w + x) * 4,
      );
    }
    const durationMs = ((samples[index + 1]?.time ?? sample.time + run.dt) - sample.time) * 1000;
    const state = actState(run.act, sample.time, meta.duration);
    return {
      filename: `${meta.id}/${String(index).padStart(4, '0')}`,
      frame: { x, y, w: meta.w, h: meta.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: meta.w, h: meta.h },
      sourceSize: { w: meta.w, h: meta.h },
      time: sample.time,
      duration: Math.round(durationMs * 1000) / 1000,
      ...(state.phase ? { phase: state.phase } : {}),
      ...(state.pose ? { pose: state.pose } : {}),
    };
  });

  const output = resolve(outDir ?? join('records', meta.id));
  await mkdir(output, { recursive: true });
  const png = join(output, paper ? 'sheet-paper.png' : 'sheet.png');
  const json = join(output, paper ? 'sheet-paper.json' : 'sheet.json');
  const atlas = {
    frames,
    meta: {
      app: 'inkfx / fx-skill-kit',
      image: paper ? 'sheet-paper.png' : 'sheet.png',
      format: 'RGBA8888',
      background: paper ? 'xuan-paper' : 'transparent',
      size: { w: image.w, h: image.h },
      scale: '1',
      effect: meta.id,
      seed: run.seed,
      fps: run.fps,
      loop: meta.loop,
      origin: { x: meta.ox, y: meta.oy },
      act: run.act,
      inkfx: {
        palette: palette ?? 'songyan',
        paperBackground: Boolean(paper),
        act: run.act,
        frameTags: run.act ? [
          ...(run.act.windup ? [{ name: 'windup', from: 0, to: Math.max(0, frames.findIndex(f => f.time >= 0) - 1) }] : []),
          { name: 'active', from: Math.max(0, frames.findIndex(f => f.time >= 0)), to: frames.length - 1 },
        ] : [{ name: 'active', from: 0, to: frames.length - 1 }],
      },
      timeline: run.timeline,
    },
  };

  await writeFile(png, encodePNG(image));
  await writeFile(json, `${JSON.stringify(atlas, null, 2)}\n`);
  return { png, json, atlas };
}

export async function main(args = process.argv.slice(2), { log = console.log } = {}) {
  const { files, options } = parseArgs(args, ['seed', 'fps', 'columns', 'out', 'palette'], ['paper']);
  if (options.help || !files.length) {
    log('Usage: node tools/export-sheet.mjs <id|file.js> [--palette songyan|zhusha|shiqing|nijin] [--paper] [--fps 30] [--columns 8] [--seed 42] [--out dir]');
    if (!options.help && !files.length) throw new Error('Provide at least one FX id or file path');
    return;
  }
  for (const input of files) {
    const file = await resolveFXFile(input);
    const result = await exportInkSheet(file, {
      seed: numberOption(options, 'seed', 42),
      fps: numberOption(options, 'fps', 30),
      columns: numberOption(options, 'columns', 8),
      palette: options.palette?.startsWith('[') ? JSON.parse(options.palette) : options.palette,
      paper: Boolean(options.paper),
      outDir: options.out ? resolve(dirname(options.out.endsWith('.png') ? options.out : join(options.out, 'sheet.png'))) : undefined,
    });
    log(`Exported sprite sheet for ${input}\n  ${result.png}\n  ${result.json}`);
  }
}

if (isMain(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
