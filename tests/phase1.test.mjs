import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { checkFX, main as checkMain } from '../tools/check.mjs';
import { renderFX, main as renderMain } from '../tools/render.mjs';
import { main as newMain } from '../tools/new.mjs';
import { createFrame, fillCircle, setPixel, clear } from '../src/core/frame.js';
import { loadFX, sampleFX, withoutMathRandom, mse } from '../src/core/run.js';
import { encodePNG, crc32 } from '../src/core/png.js';
import { mulberry32 } from '../src/core/seed.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const example = id => join(root, 'examples/fx', `${id}.js`);
// Exercise the real CLI entrypoints in process: no shell, subprocess, or test dependency.
async function cli(tool, args = []) {
  const originalLog = console.log;
  const originalExit = process.exitCode;
  const lines = [];
  console.log = (...parts) => lines.push(parts.join(' '));
  process.exitCode = 0;
  let stderr = '';
  try { await ({ new: newMain, check: checkMain, render: renderMain }[tool])(args); }
  catch (error) { stderr = error.message; process.exitCode = 1; }
  finally { console.log = originalLog; }
  const status = process.exitCode ?? 0;
  process.exitCode = originalExit;
  return { status, stdout: lines.join('\n'), stderr };
}
async function temporary(t) {
  const dir = await mkdtemp(join(root, '.fx-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function fixture(t, body, { loop = false, prelude = '' } = {}) {
  const file = join(await temporary(t), 'fixture.js');
  await writeFile(file, `${prelude}\nexport const meta = { id:'fixture', duration:1, loop:${loop}, w:32, h:32, ox:16, oy:16 };
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
  const result = await cli('new', ['sample-fx', '--out', dir]);
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
  assert.notEqual((await cli('new', ['sample-fx', '--out', dir])).status, 0);
  assert.deepEqual(await readFile(file), before);
  assert.notEqual((await cli('new', ['../escape', '--out', dir])).status, 0);
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
