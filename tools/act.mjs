import { join } from 'node:path';
import { loadFX, sampleFX, withoutMathRandom } from '../src/core/run.js';
import { actTimeline } from '../src/core/act.js';
import { renderRun } from './render.mjs';
import { examples, isMain, parseArgs, numberOption, resolveFXFile } from './cli.mjs';

export async function actFX(file, { seed = 1, columns = 6, outDir } = {}) {
  const run = await withoutMathRandom(async () => {
    const fx = await loadFX(file);
    return { ...sampleFX(fx, { seed, fps: 12, fixedFps: true, ...actTimeline(fx) }), act: fx.act ?? fx.meta.act };
  });
  // Every frame is selected, even for long timelines: no 16/256-frame truncation.
  return renderRun(run, { columns, outDir, basename: 'act-strip' });
}

export async function main(args = process.argv.slice(2), { log = console.log } = {}) {
  const { files, options } = parseArgs(args, ['seed', 'columns', 'out']);
  if (options.help) {
    log('Usage: npm run act -- [file.js|id ...] [--seed 1] [--columns 6] [--out directory] (fixed 12fps)');
    return;
  }
  const targets = files.length ? files : examples;
  for (const [index, input] of targets.entries()) {
    const outDir = options.out && (targets.length === 1 ? options.out : join(options.out, String(index)));
    const result = await actFX(await resolveFXFile(input), {
      seed: numberOption(options, 'seed', 1), columns: numberOption(options, 'columns', 6), outDir,
    });
    log(`Rendered ${input} at 12fps\n  ${result.png}\n  ${result.json}`);
  }
}

if (isMain(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
