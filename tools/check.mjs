import { loadFX, sampleFX, mse, withoutMathRandom } from '../src/core/run.js';
import { examples, isMain, parseArgs, numberOption } from './cli.mjs';

export async function checkFX(file, { seed = 1, fps = 30, edgeThreshold = 0.005, seamThreshold = 0.5 } = {}) {
  if (!Number.isFinite(edgeThreshold) || edgeThreshold < 0 || edgeThreshold > 1 ||
      !Number.isFinite(seamThreshold) || seamThreshold < 0) throw new Error('Invalid check thresholds');
  const checks = [];
  let a, b;
  try {
    await withoutMathRandom(async () => {
      a = sampleFX(await loadFX(file), { seed, fps });
      b = sampleFX(await loadFX(file), { seed, fps });
    });
    checks.push({ id: 'CHK-01', pass: a.hash === b.hash, detail: `Determinism SHA-256 ${a.hash} / ${b.hash}` });
  } catch (error) {
    checks.push({ id: 'CHK-01', pass: false, detail: `Determinism: ${error.message}` });
    return { file, pass: false, checks };
  }
  const edge = Math.max(...a.frames.map(frame => frame.edgeRatio), ...b.frames.map(frame => frame.edgeRatio));
  checks.push({ id: 'CHK-02', pass: edge < edgeThreshold,
    detail: `Edge Spill ${(edge * 100).toFixed(3)}% < ${(edgeThreshold * 100).toFixed(3)}%` });
  if (a.meta.loop) {
    const seam = Math.max(mse(a.frames[0].data, a.frames.at(-1).data), mse(b.frames[0].data, b.frames.at(-1).data));
    checks.push({ id: 'CHK-03', pass: seam <= seamThreshold, detail: `Loop Seam MSE ${seam.toFixed(6)} <= ${seamThreshold}` });
  } else {
    checks.push({ id: 'CHK-03', pass: true, skip: true, detail: 'Loop Seam: meta.loop=false' });
  }
  // CHK-04 reserved: blank / overexposed frames.
  // CHK-05 reserved: 120 Hz performance budget.
  // CHK-06 reserved: domain-specific plugins.
  return { file, pass: checks.every(check => check.pass), checks, hash: a.hash };
}

export async function main(args = process.argv.slice(2)) {
  const { files, options } = parseArgs(args, ['seed', 'fps', 'edge-threshold', 'seam-threshold']);
  if (options.help) {
    console.log('Usage: npm run check -- [file.js ...] [--seed 1] [--fps 30] [--edge-threshold 0.005] [--seam-threshold 0.5]');
    return;
  }
  let failed = false;
  for (const file of files.length ? files : examples) {
    const result = await checkFX(file, {
      seed: numberOption(options, 'seed', 1), fps: numberOption(options, 'fps', 30),
      edgeThreshold: numberOption(options, 'edge-threshold', 0.005),
      seamThreshold: numberOption(options, 'seam-threshold', 0.5),
    });
    console.log(file);
    for (const check of result.checks) console.log(`  ${check.skip ? 'SKIP' : check.pass ? 'PASS' : 'FAIL'} ${check.id} ${check.detail}`);
    failed ||= !result.pass;
  }
  if (failed) process.exitCode = 1;
}

if (isMain(import.meta.url)) main().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
