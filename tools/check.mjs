import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadFX, sampleFX, mse, withoutMathRandom } from '../src/core/run.js';
import { createFrame, clear } from '../src/core/frame.js';
import { examples, isMain, parseArgs, numberOption, resolveFXFile } from './cli.mjs';

const median = values => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// Use a private clock so FX cannot access the guarded wall/performance clocks.
export function frameBudget(fx, { seed = 42, warmupSteps = 360, clock = () => Number(process.hrtime.bigint()) / 1e6 } = {}) {
  const frame = createFrame(fx.meta.w, fx.meta.h, fx.meta.ox, fx.meta.oy);
  let effect;
  const times = [];
  for (let index = -warmupSteps; index < 300; index++) {
    // Replay the declared lifetime, including for non-loops; do not benchmark a dead tail.
    if (!effect || effect.t + 1 / 120 > fx.meta.duration + 1e-10) effect = fx.create({ seed });
    const start = index >= 0 ? clock() : 0;
    effect.step(1 / 120);
    clear(frame);
    effect.draw(frame);
    if (index >= 0) times.push(clock() - start);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.ceil(times.length * 0.95) - 1];
  const max = times.at(-1);
  return { pass: p95 < 1.5 && max < 3, p95, max, steps: 300, hz: 120, warmupSteps };
}

let configImports = 0;
async function domainChecks(configFile, ctx) {
  try { await readFile(configFile); }
  catch (error) {
    if (error.code === 'ENOENT') return { id: 'CHK-06', pass: true, skip: true, detail: 'Domain Plugin: no fx.config.js' };
    throw error;
  }
  const url = pathToFileURL(resolve(configFile));
  url.searchParams.set('check', String(++configImports));
  const module = await import(url.href);
  const plugins = module.domainChecks ?? module.default?.domainChecks ?? [];
  if (!Array.isArray(plugins)) throw new Error('domainChecks must be an array');
  const results = [];
  const ids = new Set();
  for (const plugin of plugins) {
    if (!plugin || typeof plugin.id !== 'string' || !plugin.id || ids.has(plugin.id) || typeof plugin.run !== 'function') {
      throw new Error('Each domain check needs a unique id and run(ctx)');
    }
    ids.add(plugin.id);
    try {
      const value = await plugin.run(ctx);
      const result = typeof value === 'boolean' ? { pass: value } : value;
      if (!result || typeof result.pass !== 'boolean' || (result.skip && !result.pass)) {
        throw new Error('run(ctx) must return boolean or {pass:boolean, detail?, skip?}');
      }
      results.push({ id: plugin.id, pass: result.pass, skip: Boolean(result.skip), detail: String(result.detail ?? '') });
    } catch (error) {
      results.push({ id: plugin.id, pass: false, detail: error.message });
    }
  }
  return { id: 'CHK-06', pass: results.every(result => result.pass), skip: !results.length,
    detail: `Domain Plugin: ${results.length ? results.map(result => `${result.id}: ${result.skip ? 'SKIP' : result.pass ? 'PASS' : 'FAIL'} ${result.detail}`).join('; ') : 'no checks registered'}`,
    plugins: results };
}

export async function checkFX(file, {
  seed = 42, fps = 30, edgeThreshold = 0.015, seamThreshold = 0.5,
  perfSoft = false, configFile = 'fx.config.js',
} = {}) {
  if (!Number.isFinite(edgeThreshold) || edgeThreshold < 0 || edgeThreshold > 1 ||
      !Number.isFinite(seamThreshold) || seamThreshold < 0) throw new Error('Invalid check thresholds');
  const checks = [];
  let a, b, fx;
  try {
    await withoutMathRandom(async () => {
      fx = await loadFX(file);
      a = sampleFX(fx, { seed, fps });
      b = sampleFX(await loadFX(file), { seed, fps });
    });
    checks.push({ id: 'CHK-01', pass: a.hash === b.hash, detail: `Determinism seed=${seed} SHA-256 ${a.hash} / ${b.hash}` });
  } catch (error) {
    checks.push({ id: 'CHK-01', pass: false, detail: `Determinism: ${error.message}` });
    return { file, pass: false, checks };
  }
  const runs = [a, b];
  const edge = Math.max(...runs.flatMap(run => run.frames.map(frame => frame.edgeRatio)));
  const transition = /(?:^|\/)transitions\//.test(String(file).replaceAll('\\', '/')) ||
    /(?:^|\/)transitions\//.test(a.meta.id) || a.meta.category === 'transitions';
  checks.push({ id: 'CHK-02', pass: transition || edge < edgeThreshold, skip: transition,
    detail: transition ? 'Edge Spill: transitions exemption' : `Edge Spill ${(edge * 100).toFixed(3)}% < ${(edgeThreshold * 100).toFixed(3)}%` });
  if (a.meta.loop) {
    const seams = runs.map(run => {
      const seam = mse(run.frames[0].data, run.frames.at(-1).data);
      const adjacent = median(run.frames.slice(1).map((frame, i) => mse(run.frames[i].data, frame.data)));
      const limit = Math.max(seamThreshold, adjacent * 1.5);
      return { seam, medianAdjacent: adjacent, limit, pass: seam <= limit };
    });
    checks.push({ id: 'CHK-03', pass: seams.every(seam => seam.pass), runs: seams,
      detail: `Loop Seam ${seams.map(s => `MSE ${s.seam.toFixed(6)} <= max(${seamThreshold}, median ${s.medianAdjacent.toFixed(6)} x 1.5)`).join('; ')}` });
  } else {
    checks.push({ id: 'CHK-03', pass: true, skip: true, detail: 'Loop Seam: meta.loop=false' });
  }
  const dead = runs.map(run => {
    const frames = run.frames.filter(frame => frame.time >= 0); // Exclude negative windup.
    const maxFill = Math.max(...frames.map(frame => frame.fillRatio));
    let trailing = 0;
    for (let i = frames.length - 1; i >= 0 && frames[i].fillRatio <= 1e-6; i--) trailing++;
    const trailingRatio = Math.min(1, trailing * run.dt / run.meta.duration);
    return { maxFill, trailingRatio, pass: maxFill >= 0.002 && maxFill <= 0.85 && trailingRatio <= 0.15 };
  });
  checks.push({ id: 'CHK-04', pass: dead.every(run => run.pass), runs: dead,
    detail: `Dead Frames: peak fill ${(Math.max(...dead.map(r => r.maxFill)) * 100).toFixed(3)}% (0.2%-85%); blank tail ${(Math.max(...dead.map(r => r.trailingRatio)) * 100).toFixed(2)}% <= 15%` });
  if (process.env.FX_CHECK_PERF === '0') {
    checks.push({ id: 'CHK-05', pass: true, skip: true, detail: 'Frame Budget: FX_CHECK_PERF=0' });
  } else {
    try {
      const budget = await withoutMathRandom(async () => frameBudget(await loadFX(file), { seed }));
      checks.push({ id: 'CHK-05', ...budget, pass: budget.pass || perfSoft, soft: !budget.pass && perfSoft,
        budgetPass: budget.pass, detail: `Frame Budget: 300 steps at 120Hz; p95 ${budget.p95.toFixed(3)}ms < 1.5ms; max ${budget.max.toFixed(3)}ms < 3.0ms` });
    } catch (error) {
      checks.push({ id: 'CHK-05', pass: false, detail: `Frame Budget: ${error.message}` });
    }
  }
  try {
    checks.push(await domainChecks(configFile, { file, fx, meta: a.meta, seed, fps, frames: a.frames, run: a, runs }));
  } catch (error) {
    checks.push({ id: 'CHK-06', pass: false, detail: `Domain Plugin: ${error.message}` });
  }
  return { file, pass: checks.every(check => check.pass), checks, hash: a.hash };
}

export async function main(args = process.argv.slice(2), { log = console.log } = {}) {
  const { files, options } = parseArgs(args, ['seed', 'fps', 'edge-threshold', 'seam-threshold', 'config'], ['perf-soft']);
  if (options.help) {
    log('Usage: npm run check -- [file.js|id ...] [--seed 42] [--fps 30] [--edge-threshold 0.015] [--seam-threshold 0.5] [--perf-soft] [--config fx.config.js]');
    return;
  }
  let failed = false;
  for (const input of files.length ? files : examples) {
    const file = await resolveFXFile(input);
    const result = await checkFX(file, {
      seed: numberOption(options, 'seed', 42), fps: numberOption(options, 'fps', 30),
      edgeThreshold: numberOption(options, 'edge-threshold', 0.015),
      seamThreshold: numberOption(options, 'seam-threshold', 0.5),
      perfSoft: Boolean(options['perf-soft']), configFile: options.config,
    });
    log(file);
    for (const check of result.checks) log(`  ${check.skip ? 'SKIP' : check.soft ? 'WARN' : check.pass ? 'PASS' : 'FAIL'} ${check.id} ${check.detail}`);
    failed ||= !result.pass;
  }
  if (failed) process.exitCode = 1;
}

if (isMain(import.meta.url)) main().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
