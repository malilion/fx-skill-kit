import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openEffect, createFrame } from 'fx-skill-kit';
import { encodePNG } from '../src/core/png.js';
import { encodeFramePNG } from '../src/core/png-bytes.js';
import { createGallerySession } from '../gallery/session.js';
import { exportAsset } from '../tools/export.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function drawEffect(palette) {
  const fx = openEffect('pulse-dot');
  const effect = fx.create({ seed: 1, palette });
  const frame = createFrame(fx.meta.w, fx.meta.h, fx.meta.ox, fx.meta.oy);
  effect.step(0.45);
  effect.draw(frame);
  return frame;
}

function pngPixels(buffer) {
  const png = Buffer.from(buffer);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const compressed = [];
  let w = 0;
  let h = 0;
  for (let pos = 8; pos + 8 <= png.length;) {
    const length = png.readUInt32BE(pos);
    const type = png.toString('ascii', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === 'IDAT') compressed.push(data);
    pos += 12 + length;
    if (type === 'IEND') break;
  }
  const raw = inflateSync(Buffer.concat(compressed));
  const pixels = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    assert.equal(raw[y * (w * 4 + 1)], 0);
    raw.copy(pixels, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1));
  }
  return { w, h, pixels };
}

function headerBytes(header) {
  return [...header.matchAll(/0x([0-9a-f]{2})/g)].map(match => parseInt(match[1], 16));
}

function paintSpan(frame) {
  let minX = frame.w;
  let minY = frame.h;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) {
    if (frame.data[(y * frame.w + x) * 4 + 3] <= 16) continue;
    count++;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { count, w: maxX - minX + 1, h: maxY - minY + 1 };
}

test('public runtime entry draws a bundled effect and a named palette changes RGB', () => {
  const ink = drawEffect('ink');
  const zhusha = drawEffect('zhusha');
  assert.equal(ink.w, 160);
  assert.equal(ink.h, 160);
  assert.ok([...ink.data].some((value, index) => index % 4 === 3 && value > 0));
  assert.ok([...ink.data].some((value, index) => index % 4 !== 3 && value !== zhusha.data[index]));
});

test('plugin manifest resolves to the authoring skill', async () => {
  const manifest = JSON.parse(await readFile(join(root, '.claude-plugin/plugin.json'), 'utf8'));
  const entries = Array.isArray(manifest.skills) ? manifest.skills : [manifest.skills];
  assert.ok(entries.length >= 1);
  const skillPath = resolve(root, entries[0].endsWith('SKILL.md') ? entries[0] : join(entries[0], 'SKILL.md'));
  const text = await readFile(skillPath, 'utf8');
  assert.match(text, /^---\nname: fx-authoring\n/);
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  const checkAt = body.search(/npm run check|tools\/check/);
  const sheetAt = body.search(/contact\.png|contact sheet/i);
  assert.ok(checkAt >= 0 && sheetAt > checkAt, 'skill must require check before the contact sheet');
});

test('gallery session changes palette and tilt, and downloads source, PNG, and C header', async t => {
  const session = createGallerySession({ id: 'pulse-dot', seed: 1 });
  assert.equal(session.tick, 0);
  let bestTick = session.tick;
  let bestCount = paintSpan(session.frame).count;
  const cap = Math.ceil(session.meta.duration / session.dt) + 2;
  for (let guard = 0; guard < cap; guard++) {
    const tick = session.tick;
    session.advance(session.dt);
    if (session.tick === tick) break;
    const count = paintSpan(session.frame).count;
    if (count > bestCount) {
      bestCount = count;
      bestTick = session.tick;
    }
  }
  session.setEffect(session.id);
  assert.equal(session.tick, 0);
  while (session.tick < bestTick) session.advance(session.dt);
  assert.equal(session.tick, bestTick);
  const span = paintSpan(session.frame);
  assert.equal(session.frame.w, 160);
  assert.equal(session.frame.h, 160);
  assert.ok(span.count > session.frame.w * session.frame.h * 0.5, `painted pixels ${span.count}`);
  assert.ok(span.w > session.frame.w * 0.5 && span.h > session.frame.h * 0.5);

  const base = Buffer.from(session.frame.data);
  session.setPalette('zhusha');
  const colored = Buffer.from(session.frame.data);
  assert.ok([...base].some((value, index) => index % 4 !== 3 && value !== colored[index]));
  session.setPalette('');
  assert.deepEqual(Buffer.from(session.frame.data), base);
  session.setTilt(0.85, -0.7);
  assert.notDeepEqual(Buffer.from(session.frame.data), base);

  const orbit = createGallerySession({ id: 'orbit-loop', seed: 2 });
  const orbitBase = Buffer.from(orbit.frame.data);
  orbit.setTilt(-1, 1);
  assert.notDeepEqual(Buffer.from(orbit.frame.data), orbitBase);

  const source = await session.copySource();
  const disk = await readFile(join(root, 'examples/fx/pulse-dot.js'), 'utf8');
  assert.equal(source, disk);
  assert.match(source, /id: 'pulse-dot'/);

  const png = session.png();
  assert.deepEqual(Buffer.from(png), Buffer.from(encodeFramePNG(session.frame)));
  const downloaded = pngPixels(png);
  const encoded = pngPixels(encodePNG(session.frame));
  assert.equal(downloaded.w, session.frame.w);
  assert.equal(downloaded.h, session.frame.h);
  assert.deepEqual(downloaded.pixels, encoded.pixels);
  assert.deepEqual(downloaded.pixels, Buffer.from(session.frame.data));

  const header = session.header();
  assert.match(header, new RegExp(`#define FX_PULSE_DOT_W ${session.frame.w}\\b`));
  assert.match(header, new RegExp(`#define FX_PULSE_DOT_H ${session.frame.h}\\b`));
  const dir = await mkdtemp(join(root, '.fx-surface-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const fixture = join(dir, 'mask-frame.js');
  const b64 = Buffer.from(session.frame.data).toString('base64');
  await writeFile(fixture, `export const meta={id:'mask-frame',duration:1/30,loop:false,w:${session.frame.w},h:${session.frame.h},ox:1,oy:1};
const pixels=Uint8ClampedArray.from(Buffer.from('${b64}','base64'));
export function create(){return {t:0,step(dt){this.t+=dt},draw(frame){frame.data.set(pixels)}}}`);
  const cli = await exportAsset(fixture, 'c-header', { outDir: dir, seed: 1 });
  const cliHeader = await readFile(cli.files[0], 'utf8');
  assert.match(cliHeader, new RegExp(`#define FX_MASK_FRAME_W ${session.frame.w}\\b`));
  assert.match(cliHeader, new RegExp(`#define FX_MASK_FRAME_H ${session.frame.h}\\b`));
  const stride = session.frame.w * Math.ceil(session.frame.h / 8);
  const galleryMask = headerBytes(header);
  const cliMask = headerBytes(cliHeader);
  assert.equal(galleryMask.length, stride);
  assert.deepEqual(galleryMask, cliMask.slice(0, stride));
  assert.deepEqual(cliMask.slice(0, stride), cliMask.slice(stride, stride * 2));
});

test('gallery showFilledFrame rests on the bloom and a restart begins at tick 0', () => {
  const session = createGallerySession({ id: 'pulse-dot', seed: 1 });
  assert.equal(session.tick, 0);
  assert.equal(session.ended, false);
  session.showFilledFrame();
  const span = paintSpan(session.frame);
  assert.ok(span.count > session.frame.w * session.frame.h * 0.5, `painted pixels ${span.count}`);
  assert.equal(session.ended, false);
  assert.ok(session.tick > 0);
  session.setEffect('pulse-dot');
  assert.equal(session.tick, 0);
  assert.equal(session.ended, false);
});

test('gallery one-shot pauses on its final frame instead of seeking to the bloom', async () => {
  const pulse = createGallerySession({ id: 'pulse-dot', seed: 1 });
  assert.equal(pulse.holdEnded(), false);
  const limit = Math.ceil(pulse.meta.duration / 0.1) + 2;
  let previous = -1;
  for (let steps = 0; steps < limit && pulse.tick !== previous; steps++) {
    previous = pulse.tick;
    pulse.advance(0.1);
  }
  assert.equal(pulse.ended, true);
  const heldTick = pulse.tick;
  const held = Buffer.from(pulse.frame.data);
  assert.equal(paintSpan(pulse.frame).count, 0);
  assert.equal(pulse.holdEnded(), true);
  assert.equal(pulse.paused, true);
  assert.equal(pulse.tick, heldTick);
  assert.deepEqual(Buffer.from(pulse.frame.data), held);
  assert.equal(pulse.holdEnded(), false);
  pulse.advance(0.1);
  assert.equal(pulse.tick, heldTick);
  assert.deepEqual(Buffer.from(pulse.frame.data), held);

  const page = await readFile(join(root, 'gallery/index.html'), 'utf8');
  const animateAt = page.indexOf('function animate');
  const animate = page.slice(animateAt, page.indexOf('requestAnimationFrame(animate)', animateAt));
  assert.match(animate, /holdEnded\(\)/);
  assert.doesNotMatch(animate, /pose\(|showFilledFrame\(/);
  assert.match(page, /function pose\(\)[\s\S]*showFilledFrame\(\)/);
  assert.match(page, /playFromStart\(\)/);
});

test('gallery advance holds a one-shot past its duration and wraps a loop', () => {
  const pulse = createGallerySession({ id: 'pulse-dot', seed: 1 });
  assert.equal(pulse.tick, 0);
  assert.equal(pulse.meta.loop, false);
  const limit = Math.ceil(pulse.meta.duration / 0.1) + 2;
  let previous = -1;
  let steps = 0;
  for (; steps < limit && pulse.tick !== previous; steps++) {
    previous = pulse.tick;
    pulse.advance(0.1);
  }
  assert.ok(steps < limit, 'one-shot kept advancing past its duration');
  assert.ok(pulse.tick * pulse.dt + 1e-9 >= pulse.meta.duration);
  const heldTick = pulse.tick;
  const held = Buffer.from(pulse.frame.data);
  pulse.advance(0.1);
  assert.equal(pulse.tick, heldTick);
  assert.deepEqual(Buffer.from(pulse.frame.data), held);
  pulse.setEffect('pulse-dot');
  assert.equal(pulse.tick, 0);

  const orbit = createGallerySession({ id: 'orbit-loop', seed: 2 });
  assert.equal(orbit.tick, 0);
  assert.equal(orbit.meta.loop, true);
  const calls = Math.ceil((orbit.meta.duration + 0.2) / 0.1);
  let maxTick = orbit.tick;
  for (let i = 0; i < calls; i++) {
    orbit.advance(0.1);
    maxTick = Math.max(maxTick, orbit.tick);
  }
  assert.ok(orbit.tick < maxTick, `loop tick ${orbit.tick} did not wrap below ${maxTick}`);
  const wrapped = Buffer.from(orbit.frame.data);
  orbit.advance(0.1);
  assert.notDeepEqual(Buffer.from(orbit.frame.data), wrapped);
});

function stopGallery(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* already exited */ } }
}

function bootGallery() {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'gallery'], {
      cwd: root,
      env: { ...process.env, PORT: '0' },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      stopGallery(child);
      reject(new Error(`gallery did not listen\n${output}`));
    }, 15000);
    const onData = chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)\/gallery\//);
      if (!match || settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ child, port: Number(match[1]) });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', error => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
    child.on('exit', code => {
      if (!settled) { settled = true; clearTimeout(timer); reject(new Error(`gallery exited ${code}\n${output}`)); }
    });
  });
}

test('gallery server serves the control page twice', async t => {
  const htmlPath = join(root, 'gallery/index.html');
  const file = await readFile(htmlPath, 'utf8');
  assert.match(file, /file:/);
  for (let boot = 0; boot < 2; boot++) {
    const server = await bootGallery();
    t.after(() => stopGallery(server.child));
    const response = await fetch(`http://127.0.0.1:${server.port}/gallery/`);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /<canvas id="preview" width="160" height="160"/);
    assert.match(body, /id="palette"/);
    assert.match(body, /View \/ tilt/);
    assert.match(body, /id="tilt-x"/);
    assert.match(body, /id="copy"/);
    assert.match(body, /id="download-png"/);
    assert.match(body, /id="download-header"/);
    assert.match(body, /Download PNG/);
    assert.match(body, /Download C header/);
    assert.match(body, /file:/);
    assert.match(body, /npm run gallery/);
    const logo = await fetch(`http://127.0.0.1:${server.port}/gallery/logo.svg`);
    assert.equal(logo.status, 200);
    assert.match(logo.headers.get('content-type'), /svg/);
    stopGallery(server.child);
  }
});
