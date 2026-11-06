import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access, rm, mkdir, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { checkFX, frameBudget, main as checkMain } from '../tools/check.mjs';
import { renderFX, main as renderMain } from '../tools/render.mjs';
import { main as newMain } from '../tools/new.mjs';
import { actFX, main as actMain } from '../tools/act.mjs';
import { createFrame, fillCircle, setPixel, clear } from '../src/core/frame.js';
import { loadFX, sampleFX, withoutMathRandom, mse } from '../src/core/run.js';
import { encodePNG, crc32 } from '../src/core/png.js';
import { mulberry32 } from '../src/core/seed.js';

// Functional checks must not depend on host scheduling. The budget tests below
// exercise strict thresholds with an injected clock and a real 5ms slow frame;
// `npm run check` remains the strict, real-clock integration benchmark.
const originalPerfEnv = process.env.FX_CHECK_PERF;
process.env.FX_CHECK_PERF = '0';
after(() => {
  if (originalPerfEnv === undefined) delete process.env.FX_CHECK_PERF;
  else process.env.FX_CHECK_PERF = originalPerfEnv;
});

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const example = id => join(root, 'examples/fx', `${id}.js`);
// Exercise the real CLI entrypoints in process: no shell, subprocess, or test dependency.
async function cli(tool, args = []) {
  const originalExit = process.exitCode;
  const lines = [];
  process.exitCode = 0;
  let stderr = '';
  try { await ({ new: newMain, check: checkMain, render: renderMain, act: actMain }[tool])(args, { log: (...parts) => lines.push(parts.join(' ')) }); }
  catch (error) { stderr = error.message; process.exitCode = 1; }
  const status = process.exitCode ?? 0;
  process.exitCode = originalExit;
  return { status, stdout: lines.join('\n'), stderr };
}
async function temporary(t) {
  const dir = await mkdtemp(join(root, '.fx-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function fixture(t, body, { loop = false, prelude = '', meta = {} } = {}) {
  const file = join(await temporary(t), 'fixture.js');
  await writeFile(file, `${prelude}\nexport const meta = ${JSON.stringify({ id: 'fixture', duration: 1, loop, w: 32, h: 32, ox: 16, oy: 16, ...meta })};
export function create({seed}) { return { t:0, step(dt) { this.t += dt; }, draw(frame) { ${body} } }; }`);
  return file;
}

function decodePNG(buffer) {
  assert.deepEqual(buffer.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const idat = [];
  let w, h;
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    assert.equal(buffer.readUInt32BE(offset + 8 + length), crc32(buffer.subarray(offset + 4, offset + 8 + length)), `${type} CRC`);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); assert.equal(data[9], 6); }
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
    if (type === 'IEND') assert.equal(offset, buffer.length);
  }
  const bytes = inflateSync(Buffer.concat(idat));
  assert.equal(bytes.length, (w * 4 + 1) * h);
  const pixels = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    assert.equal(bytes[y * (w * 4 + 1)], 0, 'PNG filter is None');
    bytes.copy(pixels, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1));
  }
  return { w, h, pixels };
}

test('new CLI scaffolds a working seedable module and refuses overwrite / traversal', async t => {
  const dir = await temporary(t);
  const catalog = join(dir, 'catalog.json');
  const result = await cli('new', ['sample-fx', '--out', dir, '--catalog', catalog]);
  assert.equal(result.status, 0, result.stderr);
  const file = join(dir, 'sample-fx.js');
  await access(file);
  const fx = await loadFX(file);
  assert.equal(fx.meta.id, 'sample-fx');
  const instance = fx.create({ seed: 7 });
  assert.equal(instance.t, 0);
  instance.step(0.25);
  assert.equal(instance.t, 0.25);
  assert.equal((await checkFX(file)).pass, true);
  const a = sampleFX(fx, { seed: 7 }).hash;
  assert.notEqual(a, sampleFX(fx, { seed: 8 }).hash);
  const before = await readFile(file);
  assert.notEqual((await cli('new', ['sample-fx', '--out', dir, '--catalog', catalog])).status, 0);
  assert.deepEqual(await readFile(file), before);
  assert.notEqual((await cli('new', ['../escape', '--out', dir, '--catalog', catalog])).status, 0);
});

test('check CLI passes both examples; loop seam is tested only for looping FX', async () => {
  const result = await cli('check');
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal((result.stdout.match(/PASS CHK-01/g) ?? []).length, 2);
  assert.equal((result.stdout.match(/PASS CHK-02/g) ?? []).length, 2);
  assert.match(result.stdout, /SKIP CHK-03/);
  assert.match(result.stdout, /PASS CHK-03/);
  for (const id of ['pulse-dot', 'orbit-loop']) for (const seed of [0, 42, 0xffffffff]) {
    const checked = await checkFX(example(id), { seed });
    assert.equal(checked.pass, true, `${id}, seed=${seed}: ${JSON.stringify(checked.checks)}`);
  }
});

test('CHK-02 rejects edge spill and exits nonzero, with configurable threshold', async t => {
  const file = await fixture(t, 'for(let x=0;x<frame.w;x++) frame.data.set([1,2,3,255], x*4);');
  const result = await checkFX(file);
  assert.equal(result.checks.find(c => c.id === 'CHK-01').pass, true);
  assert.equal(result.checks.find(c => c.id === 'CHK-02').pass, false);
  assert.equal(result.pass, false);
  const processResult = await cli('check', [file]);
  assert.equal(processResult.status, 1);
  assert.match(processResult.stdout, /FAIL CHK-02 Edge Spill/);
  assert.equal((await checkFX(file, { edgeThreshold: 0.3 })).pass, true);
});

test('CHK-03 rejects a visibly discontinuous loop but skips a non-loop', async t => {
  const body = 'for(let y=10;y<22;y++) for(let x=10;x<22;x++) frame.data.set([20,80,100, this.t*255],(y*frame.w+x)*4);';
  const loop = await checkFX(await fixture(t, body, { loop: true }));
  assert.equal(loop.checks.find(c => c.id === 'CHK-03').pass, false);
  assert.equal(loop.pass, false);
  const once = await checkFX(await fixture(t, body));
  assert.equal(once.pass, true);
  assert.equal(once.checks.find(c => c.id === 'CHK-03').skip, true);
});

test('CHK-01 rejects Math.random at import, create, step, and draw; restores the guard', async t => {
  const original = Math.random;
  const dir = await temporary(t);
  for (const site of ['import', 'create', 'step', 'draw']) {
    const file = join(dir, `${site}.js`);
    await writeFile(file, `
      ${site === 'import' ? 'Math.random();' : ''}
      export const meta={id:'random-fixture',duration:1,loop:false,w:16,h:16,ox:8,oy:8};
      export function create() {
        ${site === 'create' ? 'Math.random();' : ''}
        return {t:0,step(dt){this.t+=dt;${site === 'step' ? 'Math.random();' : ''}},draw(frame){${site === 'draw' ? 'Math.random();' : ''}}};
      }`);
    const checked = await checkFX(file);
    assert.equal(checked.pass, false, site);
    assert.match(checked.checks[0].detail, /Math.random is forbidden/);
    assert.equal(Math.random, original);
    assert.equal((await cli('check', [file])).status, 1);
  }
});

test('CHK-01 catches unequal bytes even when Math.random is never called', async t => {
  t.after(() => { delete globalThis.__fxTestCounter; });
  globalThis.__fxTestCounter = 0;
  const file = await fixture(t, 'frame.data.set([value,0,0,255], (16*frame.w+16)*4);', {
    prelude: 'const value = ++globalThis.__fxTestCounter;',
  });
  const checked = await checkFX(file);
  assert.equal(checked.pass, false);
  assert.equal(checked.checks[0].pass, false);
});

test('determinism hash is stable across fresh imports and seeds change the image', async () => {
  for (const id of ['pulse-dot', 'orbit-loop']) {
    const [a, b] = await withoutMathRandom(async () => [
      sampleFX(await loadFX(example(id)), { seed: 7 }),
      sampleFX(await loadFX(example(id)), { seed: 7 }),
    ]);
    assert.match(a.hash, /^[a-f0-9]{64}$/);
    assert.equal(a.hash, b.hash);
    assert.notEqual(a.hash, sampleFX(await loadFX(example(id)), { seed: 8 }).hash);
  }
});

test('constant dt samples exact endpoints even for a duration off the fps grid', async () => {
  const fx = await loadFX(example('orbit-loop'));
  const run = sampleFX({ ...fx, meta: { ...fx.meta, duration: 0.21 } }, { fps: 30 });
  assert.equal(run.frames.length, 8);
  assert.equal(run.dt, 0.03);
  assert.equal(run.frames[0].time, 0);
  assert.equal(run.frames.at(-1).time, 0.21);
});

test('render CLI produces valid annotated PNG and full-precision JSON statistics', async t => {
  const dir = await temporary(t);
  const result = await cli('render', [example('orbit-loop'), '--out', dir, '--frames', '9', '--columns', '3']);
  assert.equal(result.status, 0, result.stderr);
  const png = decodePNG(await readFile(join(dir, 'contact.png')));
  const stats = JSON.parse(await readFile(join(dir, 'contact.json'), 'utf8'));
  assert.equal(png.w, stats.sheet.w);
  assert.equal(png.h, stats.sheet.h);
  assert.equal(stats.sheet.selected.length, 9);
  assert.equal(stats.sheet.selected[0], 0);
  assert.equal(stats.sheet.selected.at(-1), stats.frameCount - 1);
  assert.equal(stats.frames.length, 61);
  assert.equal(stats.frames.at(-1).time, 2);
  const sampled = sampleFX(await loadFX(example('orbit-loop')));
  assert.equal(stats.hash, sampled.hash);
  for (let i = 0; i < stats.frames.length; i++) {
    assert.equal(stats.frames[i].fillRatio, sampled.frames[i].fillRatio);
    assert.equal(stats.frames[i].edgeRatio, 0);
  }
  // Every cell has a guide and a crosshair at its declared origin, even a blank FX frame.
  const blank = await fixture(t, '');
  const rendered = await renderFX(blank, { outDir: join(dir, 'blank'), count: 4 });
  const decoded = decodePNG(await readFile(rendered.png));
  const bg = Buffer.from([248,244,237,255]);
  for (let cell = 0; cell < 4; cell++) {
    const cellX = 16 + cell * rendered.stats.sheet.cellW;
    const x = cellX + (rendered.stats.sheet.cellW - 32) / 2;
    const y = rendered.stats.sheet.headerH + 26;
    const pixel = (px, py) => decoded.pixels.subarray((py * decoded.w + px) * 4, (py * decoded.w + px) * 4 + 4);
    assert.notDeepEqual(pixel(x + 16, y + 16), bg, 'origin crosshair');
    assert.notDeepEqual(pixel(x + 2, y + 2), bg, 'safe-area border');
    assert.equal(rendered.stats.frames[cell].fillRatio, 0, 'overlays are excluded from fill');
  }
});

test('PNG preserves RGBA bytes and includes correct chunk CRCs', () => {
  const frame = createFrame(2, 2);
  frame.data.set([255,0,0,255, 0,255,0,128, 0,0,255,0, 12,34,56,78]);
  const png = decodePNG(encodePNG(frame));
  assert.deepEqual(png.pixels, Buffer.from(frame.data));
});

test('frame helpers clip, blend straight alpha, draw softly, and clear', () => {
  const frame = createFrame(16, 16);
  setPixel(frame, -1, 0, [255,0,0,255]);
  assert.equal(frame.data.every(x => x === 0), true);
  setPixel(frame, 8, 8, [255,0,0,128]);
  setPixel(frame, 8, 8, [0,0,255,128]);
  const offset = (8 * 16 + 8) * 4;
  assert.deepEqual(Array.from(frame.data.subarray(offset, offset + 4)), [85,0,170,192]);
  clear(frame);
  fillCircle(frame, 8, 8, 5, [10,20,30,255], 1);
  assert.ok(frame.data[offset + 3] > frame.data[(8 * 16 + 12) * 4 + 3]);
  assert.equal(frame.data[3], 0);
  clear(frame);
  assert.equal(frame.data.every(x => x === 0), true);
});

test('mulberry32 accepts seed zero and repeats; MSE uses squared byte units', () => {
  const a = mulberry32(0), b = mulberry32(0), c = mulberry32(1);
  const values = Array.from({ length: 8 }, () => a());
  assert.deepEqual(values, Array.from({ length: 8 }, () => b()));
  assert.notDeepEqual(values, Array.from({ length: 8 }, () => c()));
  assert.ok(values.every(x => x >= 0 && x < 1));
  assert.equal(mse(Uint8Array.of(0,0), Uint8Array.of(2,4)), 10);
});

test('invalid CLI values, missing inputs, and invalid metadata fail clearly', async t => {
  for (const [tool, args] of [
    ['check', ['missing-fx.js']], ['check', ['--seed', 'no']], ['check', ['--seed', '-1']],
    ['check', ['--edge-threshold', '2']], ['check', ['--fps', '0']],
    ['render', ['--frames', '1']], ['render', ['--columns', '0']], ['render', ['--unknown', '1']],
    ['new', []], ['render', ['--seed']],
  ]) {
    const result = await cli(tool, args);
    assert.notEqual(result.status, 0, `${tool} ${args}`);
  }
  const dir = await temporary(t);
  const file = join(dir, 'invalid.js');
  await writeFile(file, 'export const meta = {};');
  const checked = await checkFX(file);
  assert.equal(checked.pass, false);
  assert.match(checked.checks[0].detail, /valid meta/);
});

const solidCenter = 'for(let y=14;y<18;y++) for(let x=14;x<18;x++) frame.data.set([50,80,100,255],(y*frame.w+x)*4);';
const checkById = (result, id) => result.checks.find(check => check.id === id);

test('CHK-01 blocks Date.now and performance.now throughout the lifecycle and restores both', async t => {
  const originalDate = Date.now;
  const originalPerformance = performance.now;
  const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
  for (const clock of ['Date.now', 'performance.now']) {
    for (const site of ['import', 'create', 'step', 'draw']) {
      const file = join(await temporary(t), 'clock.js');
      await writeFile(file, `
        ${site === 'import' ? `${clock}();` : ''}
        export const meta={id:'clock-fixture',duration:1,loop:false,w:32,h:32,ox:16,oy:16};
        export function create() {
          ${site === 'create' ? `${clock}();` : ''}
          return {t:0,step(dt){this.t+=dt;${site === 'step' ? `${clock}();` : ''}},draw(frame){${site === 'draw' ? `${clock}();` : solidCenter}}};
        }`);
      const result = await checkFX(file);
      assert.equal(result.pass, false, `${clock} at ${site}`);
      assert.ok(result.checks[0].detail.includes(`${clock} is forbidden`));
      assert.equal(Date.now, originalDate);
      assert.equal(performance.now, originalPerformance);
      assert.deepEqual(Object.getOwnPropertyDescriptor(performance, 'now'), descriptor);
    }
  }
});

test('check defaults to seed 42 and preserves explicit seed zero', async () => {
  const file = example('pulse-dot');
  const result = await checkFX(file);
  assert.equal(result.hash, sampleFX(await loadFX(file), { seed: 42 }).hash);
  assert.notEqual(result.hash, (await checkFX(file, { seed: 0 })).hash);
  const cliResult = await cli('check', ['pulse-dot']);
  assert.equal(cliResult.status, 0, cliResult.stdout);
  assert.match(cliResult.stdout, /seed=42/);
});

test('CHK-02 defaults to 1.5% and exempts transition id, path, or category only', async t => {
  const oneEdgePixel = await fixture(t, `${solidCenter} frame.data.set([1,2,3,255],0);`);
  const result = await checkFX(oneEdgePixel);
  assert.equal(checkById(result, 'CHK-02').pass, true); // 1 / 124 = 0.806%, above the old 0.5%.
  assert.match(checkById(result, 'CHK-02').detail, /1.500%/);
  assert.equal(checkById(await checkFX(oneEdgePixel, { edgeThreshold: 0.005 }), 'CHK-02').pass, false);
  const spill = 'for(let x=0;x<frame.w;x++) frame.data.set([1,2,3,255],x*4);';
  for (const meta of [{ id: 'transitions/wipe' }, { category: 'transitions' }]) {
    const exempt = checkById(await checkFX(await fixture(t, spill, { meta })), 'CHK-02');
    assert.equal(exempt.pass, true);
    assert.equal(exempt.skip, true);
  }
  const source = await fixture(t, spill);
  const pathDir = join(await temporary(t), 'transitions');
  await mkdir(pathDir);
  const file = join(pathDir, 'wipe.js');
  await copyFile(source, file);
  assert.equal(checkById(await checkFX(file), 'CHK-02').skip, true);
  const ordinary = await fixture(t, spill, { meta: { id: 'not-transitions/wipe', category: 'sword' } });
  assert.equal(checkById(await checkFX(ordinary), 'CHK-02').pass, false);
});

test('CHK-03 uses playback seam vs adjacent MSE times 1.5 with explicit optional tolerance', async t => {
  const moving = await fixture(t, `const value=Math.round(this.t*32)%2*255;
    for(let y=12;y<20;y++) for(let x=12;x<20;x++) frame.data.set([value,30,40,255],(y*frame.w+x)*4);`, { loop: true });
  const relative = checkById(await checkFX(moving, { fps: 32 }), 'CHK-03');
  assert.equal(relative.pass, true);
  assert.ok(relative.runs[0].seam > 0.5);
  assert.equal(relative.runs[0].limit, relative.runs[0].medianAdjacent * 1.5);
  const almostStatic = await fixture(t, `${solidCenter} if(this.t>0.95) frame.data[(14*frame.w+14)*4]++;`, { loop: true });
  assert.equal(checkById(await checkFX(almostStatic), 'CHK-03').pass, false);
  const fallback = checkById(await checkFX(almostStatic, { seamThreshold: 0.5 }), 'CHK-03');
  assert.equal(fallback.pass, true);
  assert.equal(fallback.runs[0].medianAdjacent, 0);
  assert.equal(fallback.runs[0].limit, 0.5);
  assert.ok(fallback.runs[0].seam > 0);
});

test('CHK-04 rejects invisible and persistently overfilled FX, with inclusive fill bounds', async t => {
  for (const [body, meta, expected] of [
    ['', {}, false],
    ['frame.data.set([1,2,3,255],(16*frame.w+16)*4);', {}, false],
    ['frame.data.fill(255);', {}, false],
    ['for(let i=0;i<8500;i++) frame.data.set([1,2,3,255],i*4);', { w: 100, h: 100 }, true],
    ['for(let i=0;i<8501;i++) frame.data.set([1,2,3,255],i*4);', { w: 100, h: 100 }, false],
    ['for(let i=0;i<20;i++) frame.data.set([1,2,3,255],i*4);', { w: 100, h: 100 }, true],
    ['for(let i=0;i<19;i++) frame.data.set([1,2,3,255],i*4);', { w: 100, h: 100 }, false],
  ]) {
    const result = await checkFX(await fixture(t, body, { meta }));
    assert.equal(checkById(result, 'CHK-04').pass, expected, body || 'blank');
  }
});

test('CHK-04 measures trailing blank duration, ignores windup and permits a short fade', async t => {
  for (const [cutoff, expected] of [[0.7, false], [0.9, true], [0.86, true], [0.84, false]]) {
    const file = await fixture(t, `if(this.t<${cutoff}) { ${solidCenter} }`, { meta: { act: { windup: 10 } } });
    const checked = await checkFX(file, { fps: 100 });
    assert.equal(checkById(checked, 'CHK-04').pass, expected, String(cutoff));
  }
  const windup = await fixture(t, `if(this.t>0.8) { ${solidCenter} }`, { prelude: 'export const act={windup:0.5};' });
  assert.equal(checkById(await checkFX(windup), 'CHK-04').pass, false, 'negative windup cannot excuse an 80% blank active head');
  const tail = await fixture(t, `if(this.t<0.5) { ${solidCenter} }`);
  const result = await cli('check', [tail]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL CHK-04/);
});

test('CHK-05 warms up, measures exactly 300 step+draw calls at 120Hz, and enforces strict budgets', () => {
  let steps = 0, draws = 0, creates = 0;
  const fx = { meta: { duration: 1, w: 2, h: 2, ox: 1, oy: 1 }, create({ seed }) {
    assert.equal(seed, 42);
    creates++;
    return { t: 0, step(dt) { assert.equal(dt, 1 / 120); this.t += dt; steps++; }, draw() { draws++; } };
  } };
  let ticks = 0;
  const budget = frameBudget(fx, { clock: () => ticks++ });
  assert.equal(budget.pass, true);
  assert.equal(budget.p95, 1);
  assert.equal(budget.max, 1);
  assert.equal(budget.steps, 300);
  assert.equal(steps, 660);
  assert.equal(draws, steps);
  assert.ok(creates >= 5, 'replays animation instead of measuring beyond its lifetime');
  ticks = 0;
  assert.equal(frameBudget(fx, { clock: () => ticks++ * 1.5 }).pass, false, 'p95 limit is strict');
  ticks = 0;
  const spike = frameBudget(fx, { clock: () => {
    const call = ticks++;
    return Math.floor(call / 2) * 10 + (call % 2 ? (call === 599 ? 3 : 1) : 0);
  } });
  assert.equal(spike.p95, 1);
  assert.equal(spike.max, 3);
  assert.equal(spike.pass, false, 'max limit is strict');
});

test('CHK-05 hard fails by default, supports --perf-soft, and FX_CHECK_PERF=0 skips it', async t => {
  const originalEnv = process.env.FX_CHECK_PERF;
  t.after(() => { if (originalEnv === undefined) delete process.env.FX_CHECK_PERF; else process.env.FX_CHECK_PERF = originalEnv; });
  delete process.env.FX_CHECK_PERF;
  const file = await fixture(t, solidCenter, { prelude: '' });
  let source = await readFile(file, 'utf8');
  source = source.replace('this.t += dt;', `this.t += dt;
    if(Math.abs(dt-1/120)<1e-12 && Math.round(this.t*120)%40===0) {
      const start=process.hrtime.bigint(); while(process.hrtime.bigint()-start<5000000n) {}
    }`);
  await writeFile(file, source);
  const hard = await checkFX(file);
  assert.equal(hard.pass, false);
  assert.equal(checkById(hard, 'CHK-05').pass, false);
  assert.ok(checkById(hard, 'CHK-05').max >= 5);
  const soft = await cli('check', [file, '--perf-soft']);
  assert.equal(soft.status, 0, soft.stdout);
  assert.match(soft.stdout, /WARN CHK-05/);
  process.env.FX_CHECK_PERF = '0';
  const skipped = await checkFX(file);
  assert.equal(skipped.pass, true);
  assert.equal(checkById(skipped, 'CHK-05').skip, true);
  const otherFailure = await fixture(t, '');
  assert.equal((await checkFX(otherFailure, { perfSoft: true })).pass, false, 'perf options do not mask dead frames');
});

test('CHK-06 loads optional named/default configs and passes context to async domain checks', async t => {
  const dir = await temporary(t);
  const file = await fixture(t, solidCenter);
  const configFile = join(dir, 'fx.config.js');
  const absent = await checkFX(file, { configFile });
  assert.equal(checkById(absent, 'CHK-06').skip, true);
  await writeFile(configFile, `export const domainChecks=[{id:'custom/context', async run(ctx){
    return {pass:ctx.seed===42 && ctx.meta.id==='fixture' && ctx.frames.length===31 && ctx.runs.length===2 && ctx.fx.create instanceof Function,detail:'context checked'};
  }}];`);
  assert.equal(checkById(await checkFX(file, { configFile }), 'CHK-06').pass, true);
  await writeFile(configFile, `export default {domainChecks:[{id:'custom/fail',run(){return {pass:false,detail:'domain failure'};}},
    {id:'custom/throw',run(){throw new Error('broken plugin');}}, {id:'custom/next',run(){return true;}}]};`);
  const failed = await checkFX(file, { configFile });
  const plugins = checkById(failed, 'CHK-06');
  assert.equal(failed.pass, false);
  assert.deepEqual(plugins.plugins.map(plugin => plugin.pass), [false, false, true]);
  assert.match(plugins.detail, /broken plugin/);
  const cliResult = await cli('check', [file, '--config', configFile]);
  assert.equal(cliResult.status, 1);
  assert.match(cliResult.stdout, /FAIL CHK-06/);
  for (const source of [
    'export const domainChecks={};',
    'export const domainChecks=[{id:"invalid"}];',
    'export const domainChecks=[{id:"invalid",run(){}}];',
    'export const domainChecks=[{id:"duplicate",run(){return true;}},{id:"duplicate",run(){return true;}}];',
    'throw new Error("config import failed");',
  ]) {
    await writeFile(configFile, source);
    assert.equal(checkById(await checkFX(file, { configFile }), 'CHK-06').pass, false, source);
  }
  const exampleConfig = await checkFX(example('pulse-dot'), { configFile: join(root, 'fx.config.example.js') });
  const registered = checkById(exampleConfig, 'CHK-06');
  assert.equal(registered.pass, true);
  assert.deepEqual(registered.plugins.map(plugin => plugin.id), ['inkfx/entropy']);
  assert.equal(registered.plugins[0].pass, true);
});

test('new supports category/name, --loop/--sim and creates then updates a catalog without duplicates', async t => {
  const dir = await temporary(t);
  const outDir = join(dir, 'fx');
  const catalogFile = join(dir, 'src/catalog.json');
  for (const id of ['sword/new-slash', 'ui/new-pulse']) {
    const result = await cli('new', [id, '--loop', '--sim', '--out', outDir, '--catalog', catalogFile]);
    assert.equal(result.status, 0, result.stderr);
    const file = join(outDir, `${id}.js`);
    const fx = await loadFX(file);
    assert.equal(fx.meta.id, id);
    assert.equal(fx.meta.category, id.split('/')[0]);
    assert.equal(fx.meta.loop, true);
    assert.equal(fx.meta.sim, true);
    assert.equal((await checkFX(file)).pass, true);
  }
  const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
  assert.equal(catalog.schemaVersion, 1);
  assert.deepEqual(catalog.effects.map(effect => effect.id), ['sword/new-slash', 'ui/new-pulse']);
  for (const effect of catalog.effects) {
    await access(join(root, effect.file));
    assert.equal(effect.loop, true);
    assert.equal(effect.sim, true);
  }
  const before = await readFile(catalogFile, 'utf8');
  assert.equal((await cli('new', ['ui/new-pulse', '--out', outDir, '--catalog', catalogFile])).status, 1);
  assert.equal(await readFile(catalogFile, 'utf8'), before);
  for (const id of ['../escape', 'sword/../../escape', '/absolute', 'sword//name', 'sword/Bad', 'sword/name.js']) {
    assert.equal((await cli('new', [id, '--out', outDir, '--catalog', catalogFile])).status, 1, id);
  }
  await writeFile(catalogFile, '{}');
  assert.equal((await cli('new', ['valid/new-fx', '--out', outDir, '--catalog', catalogFile])).status, 1);
  await assert.rejects(access(join(outDir, 'valid/new-fx.js')));
});

test('act emits every frame at fixed 12fps including windup, hit freeze and recovery', async t => {
  const dir = await temporary(t);
  for (const placement of ['export', 'meta']) {
    const act = { windup: 0.2, poses: [[-0.2, 'WINDUP'], [0.5, 'RECOVER']], hits: [{ t: 0.5, freeze: 0.25 }], recovery: 0.1 };
    const file = await fixture(t, `if(this.t<0) frame.data.set([255,0,0,255],(16*frame.w+16)*4); else { ${solidCenter} }`, {
      prelude: placement === 'export' ? `export const act=${JSON.stringify(act)};` : '',
      meta: { duration: 0.6, ...(placement === 'meta' ? { act } : {}) },
    });
    const output = await actFX(file, { outDir: join(dir, placement) });
    assert.ok(output.png.endsWith('act-strip.png'));
    assert.ok(output.json.endsWith('act-strip.json'));
    const stats = JSON.parse(await readFile(output.json, 'utf8'));
    const png = decodePNG(await readFile(output.png));
    assert.equal(png.w, stats.sheet.w);
    assert.equal(png.h, stats.sheet.h);
    assert.deepEqual(stats.act, act);
    assert.ok(stats.frames.some(frame => frame.phase === 'WINDUP'));
    assert.ok(stats.frames.some(frame => frame.phase === 'FREEZE'));
    assert.ok(stats.frames.some(frame => frame.phase === 'RECOVERY'));
    assert.equal(stats.requestedFps, 12);
    assert.equal(stats.frames[0].time, -0.2);
    assert.equal(stats.frames.at(-1).time, 0.85);
    assert.equal(stats.sheet.selected.length, stats.frameCount);
    for (let i = 1; i < stats.frames.length - 1; i++) {
      assert.ok(Math.abs(stats.frames[i].time - stats.frames[i - 1].time - 1 / 12) < 1e-10);
    }
    assert.ok(stats.frames.at(-1).time - stats.frames.at(-2).time <= 1 / 12 + 1e-10);
    assert.equal(stats.frames[0].fillRatio, 1 / 1024, 'windup actually draws at negative t');
    const contact = await renderFX(file, { outDir: join(dir, `${placement}-contact`) });
    assert.equal(contact.stats.frames[0].time, -0.2, 'contact sheet includes act windup too');
  }
});

test('act without act metadata remains dense and CLI keeps --out compatibility', async t => {
  const dir = await temporary(t);
  const result = await cli('act', ['pulse-dot', '--out', dir]);
  assert.equal(result.status, 0, result.stderr);
  const stats = JSON.parse(await readFile(join(dir, 'act-strip.json'), 'utf8'));
  assert.equal(stats.frameCount, 13);
  assert.equal(stats.sheet.selected.length, 13);
  assert.equal(stats.frames[0].time, 0);
  assert.equal(stats.frames.at(-1).time, 1);
  const long = await fixture(t, solidCenter, { meta: { duration: 22 } });
  const dense = await actFX(long, { outDir: join(dir, 'long') });
  assert.equal(dense.stats.frameCount, 265);
  assert.equal(dense.stats.sheet.selected.length, 265, 'does not truncate to 256 frames');
  const invalid = await fixture(t, solidCenter, { meta: { act: { windup: -1 } } });
  assert.equal((await cli('act', [invalid, '--out', dir])).status, 1);
  assert.equal((await cli('act', ['--fps', '30'])).status, 1, 'act fps is fixed');
});

test('render and act default to records/<category/name> and catalog lists real examples', async t => {
  const id = `test-output/pulse-${process.pid}`;
  const outputDir = join(root, 'records', id);
  t.after(async () => {
    await rm(outputDir, { recursive: true, force: true });
    // Remove the empty test category only when no other test left artifacts.
    const { rmdir } = await import('node:fs/promises');
    await rmdir(dirname(outputDir)).catch(error => { if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error; });
  });
  const file = await fixture(t, solidCenter, { meta: { id } });
  const contact = await renderFX(file);
  const strip = await actFX(file);
  assert.equal(contact.png, join(outputDir, 'contact.png'));
  assert.equal(strip.png, join(outputDir, 'act-strip.png'));
  await access(contact.json);
  await access(strip.json);
  const catalog = JSON.parse(await readFile(join(root, 'src/catalog.json'), 'utf8'));
  assert.deepEqual(catalog.effects.map(effect => effect.id).sort(), ['orbit-loop', 'pulse-dot']);
  for (const effect of catalog.effects) assert.equal((await loadFX(join(root, effect.file))).meta.id, effect.id);
});
