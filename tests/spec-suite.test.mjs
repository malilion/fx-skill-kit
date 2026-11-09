import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openEffect,
  effects,
  createFrame,
  hash2d,
  valueNoise2d,
  paperGrainMap,
  mineralRamps,
  mineralRampColors,
  createInkFrame,
  clearInkFrame,
  stampDryBrush,
  stampInkStroke,
  stepInkDiffusion,
  compositeInkFrame,
  BAYER_4X4,
  ditherSample,
  ditherBuffer,
  OLED_PROFILES,
  createOledScreen,
  packVerticalPages,
  encodeXorRle,
  decodeXorRleStep,
  packRgb565Frame,
  encodeRgb565XorRle,
  decodeRgb565XorRleStep,
} from '../src/index.js';
import { checkFX } from '../tools/check.mjs';
import { exportInkSheet, main as exportSheetMain } from '../tools/export-sheet.mjs';
import { exportMcuHeader, main as exportMcuMain } from '../tools/export-mcu.mjs';
import { renderShowcaseGrid } from '../tools/showcase.mjs';
import { createGallerySession } from '../gallery/session.js';
import { inkEntropy, oledShimmer, oledRLEBudget } from '../src/checks/domain.js';
import { loadFX, sampleFX } from '../src/core/run.js';

const originalPerfEnv = process.env.FX_CHECK_PERF;
process.env.FX_CHECK_PERF = '0';
after(() => {
  if (originalPerfEnv === undefined) delete process.env.FX_CHECK_PERF;
  else process.env.FX_CHECK_PERF = originalPerfEnv;
});

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function temporary(t) {
  const dir = await mkdtemp(join(root, '.fx-suite-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('InkFX: InkFrame dual-buffer (pigment + wetness), dry-brush feibai, wet diffusion, and 4 mineral ramps', () => {
  assert.equal(hash2d(12, 34, 42), hash2d(12, 34, 42));
  assert.notEqual(hash2d(12, 34, 42), hash2d(13, 34, 42));
  const noise = valueNoise2d(3.5, 4.25, 7);
  assert.ok(noise >= 0 && noise < 1);
  const grain = paperGrainMap(32, 32, 42);
  assert.equal(grain.length, 1024);

  for (const name of ['songyan', 'zhusha', 'shiqing', 'nijin']) {
    const ramp = mineralRampColors(name);
    assert.equal(ramp.length, 6, `${name} has 6 non-linear mineral stops`);
    assert.ok(Array.isArray(mineralRamps[name]));
  }

  const wetInk = createInkFrame(64, 64, 32, 32, { seed: 42 });
  const dryInk = createInkFrame(64, 64, 32, 32, { seed: 42 });
  stampDryBrush(wetInk, 0, 0, 12, 0.0, 1.0, 0);
  stampDryBrush(dryInk, 0, 0, 12, 0.95, 1.0, 1);

  const countPainted = arr => arr.reduce((acc, v) => acc + (v > 0 ? 1 : 0), 0);
  const wetCount = countPainted(wetInk.pigment);
  const dryCount = countPainted(dryInk.pigment);
  assert.ok(wetCount > dryCount, `dry-brush feibai leaves unpainted paper grain gaps (${dryCount} < ${wetCount})`);

  // Wet diffusion spreads pigment into adjacent pixels and decays wetness
  const beforeSpread = countPainted(wetInk.pigment);
  for (let i = 0; i < 6; i++) stepInkDiffusion(wetInk, 1 / 60, { threshold: 0.05, diffusionRate: 0.35 });
  const afterSpread = countPainted(wetInk.pigment);
  assert.ok(afterSpread >= beforeSpread);

  const rgbaTransparent = createFrame(64, 64, 32, 32);
  compositeInkFrame(dryInk, rgbaTransparent, { palette: 'zhusha', paperBackground: false });
  assert.equal(rgbaTransparent.data[3], 0, 'unpainted corner remains transparent');

  const rgbaPaper = createFrame(64, 64, 32, 32);
  compositeInkFrame(dryInk, rgbaPaper, { palette: 'songyan', paperBackground: true });
  assert.equal(rgbaPaper.data[3], 255, 'Xuan paper background is opaque');

  clearInkFrame(wetInk);
  assert.equal(countPainted(wetInk.pigment), 0);
  stampInkStroke(wetInk, -10, -10, 10, 10, 3, 0.2, 0.9, 2);
  assert.ok(countPainted(wetInk.pigment) > 20);
});

test('InkFX: export-sheet CLI exports transparent and Xuan-paper sprite sheets with Wuxia act metadata', async t => {
  const dir = await temporary(t);
  const transparent = await exportInkSheet(join(root, 'src/fx/sword/sword-qi-slash.js'), {
    seed: 42,
    fps: 12,
    columns: 6,
    palette: 'zhusha',
    paper: false,
    outDir: dir,
  });
  const atlas = JSON.parse(await readFile(transparent.json, 'utf8'));
  assert.equal(atlas.meta.background, 'transparent');
  assert.equal(atlas.meta.inkfx.palette, 'zhusha');
  assert.equal(atlas.meta.inkfx.act.windup, 0.4);
  assert.ok(atlas.frames.some(f => f.phase === 'WINDUP'));
  assert.ok(atlas.frames.some(f => f.phase === 'FREEZE'));
  assert.ok(atlas.frames.some(f => f.phase === 'RECOVERY'));

  const logs = [];
  await exportSheetMain(['sword/sword-qi-slash', '--palette', 'shiqing', '--paper', '--fps', '12', '--out', dir], {
    log: s => logs.push(s),
  });
  assert.match(logs.join('\n'), /sheet-paper\.json/);
  const paperAtlas = JSON.parse(await readFile(join(dir, 'sheet-paper.json'), 'utf8'));
  assert.equal(paperAtlas.meta.background, 'xuan-paper');
  assert.equal(paperAtlas.meta.inkfx.paperBackground, true);
});

test('OLEDFX: 1-bit dithering engine (threshold, bayer4x4, checker, atkinson) & OLED virtual screen', () => {
  assert.equal(BAYER_4X4.length, 16);
  assert.equal(ditherSample(0, 0, 0, 'bayer4x4'), 0);
  assert.equal(ditherSample(0, 0, 1, 'bayer4x4'), 1);
  // Ordered Bayer 4x4 produces deterministic spatial pattern with zero temporal variation across calls
  const bayerA = [];
  const bayerB = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    bayerA.push(ditherSample(x, y, 0.5, 'bayer4x4'));
    bayerB.push(ditherSample(x, y, 0.5, 'bayer4x4'));
  }
  assert.deepEqual(bayerA, bayerB);
  assert.equal(bayerA.reduce((a, b) => a + b, 0), 8, '50% luma lights exactly 8 of 16 Bayer cells');

  // Checker mode alternates bits in a 50% checkerboard
  assert.notEqual(ditherSample(0, 0, 0.5, 'checker'), ditherSample(1, 0, 0.5, 'checker'));

  // Atkinson error-diffusion buffer dithering
  const gray = new Float32Array(16 * 16).fill(0.5);
  const atk = ditherBuffer(gray, 16, 16, 'atkinson');
  const lit = atk.reduce((a, b) => a + b, 0);
  assert.ok(lit > 64 && lit < 192);

  // Virtual OLED Screen primitives & dualZone rendering
  const screen = createOledScreen(128, 64);
  screen.fillRoundRect(10, 4, 24, 24, 5, 1.0);
  screen.fillCircle(22, 16, 4, 0.0); // carve out center
  assert.equal(screen.getPixel(22, 16), 0);
  assert.equal(screen.getPixel(14, 8), 1);

  const frame = createFrame(128, 64, 64, 32);
  screen.toFrame(frame, { dualZone: true });
  const topPixelIdx = (8 * 128 + 14) * 4;
  const bottomPixelIdx = (24 * 128 + 14) * 4;
  assert.equal(frame.data[topPixelIdx], 212, 'top 16px zone uses yellow phosphor in dualZone mode');
  assert.notEqual(frame.data[bottomPixelIdx], 212, 'bottom 48px zone uses primary cyan/ink color');
});

test('OLEDFX: export-mcu CLI XOR-Delta + RLE compression (< 4KB) and zero-malloc decoder bit-exactness', async t => {
  const dir = await temporary(t);
  const outHeader = join(dir, 'fx_curious_blink.h');
  const logs = [];
  await exportMcuMain([
    'eyes/curious-blink',
    '--profile', 'ssd1306-128x64',
    '--fps', '24',
    '--compress', 'xor-rle',
    '--out', outHeader,
  ], { log: s => logs.push(s) });

  assert.match(logs.join('\n'), /ssd1306-128x64, xor-rle/);
  const headerText = await readFile(outHeader, 'utf8');
  assert.match(headerText, /#define FX_EYES_CURIOUS_BLINK_W 128/);
  assert.match(headerText, /#define FX_EYES_CURIOUS_BLINK_H 64/);
  assert.match(headerText, /#define FX_EYES_CURIOUS_BLINK_FPS 24/);
  assert.match(headerText, /static inline void oledfx_step_frame/);

  // Verify compression budget (< 4 KB vs 48 KB raw) and bit-exact reconstruction
  const fx = await loadFX(join(root, 'src/fx/eyes/curious-blink.js'));
  const run = sampleFX(fx, { seed: 42, fps: 24 });
  const samples = run.frames.slice(0, -1);
  const encoded = encodeXorRle(samples, 128, 64);
  assert.equal(encoded.rawBytes, 48 * 1024);
  assert.ok(encoded.compressedBytes < 4096, `compressed size ${encoded.compressedBytes} bytes < 4096 bytes`);

  const fb = new Uint8Array(1024);
  for (let i = 0; i < samples.length; i++) {
    decodeXorRleStep(fb, encoded.data, encoded.offsets, i, 1024);
    const expected = packVerticalPages(samples[i], 128, 64);
    assert.deepEqual(fb, expected, `frame ${i} reconstructed bit-for-bit by zero-malloc XOR-RLE decoder`);
  }

  // Also test Mode B (XBM & Adafruit GFX), narrow profile ssd1306-128x32, and 16-bit RGB565 (st7789-128x128)
  const xbmRes = await exportMcuHeader(join(root, 'src/fx/eyes/happy-squint.js'), {
    profile: 'ssd1306-128x32',
    fps: 12,
    compress: 'xbm',
    out: join(dir, 'happy_xbm.h'),
  });
  assert.equal(xbmRes.width, 128);
  assert.equal(xbmRes.height, 32);
  const xbmText = await readFile(xbmRes.file, 'utf8');
  assert.match(xbmText, /Format: XBM/);

  // 16-bit RGB565 XOR-RLE round-trip & header generation
  const rgbSamples = samples.slice(0, 6);
  const rgbEncoded = encodeRgb565XorRle(rgbSamples, 128, 64);
  const fb565 = new Uint16Array(128 * 64);
  for (let i = 0; i < rgbSamples.length; i++) {
    decodeRgb565XorRleStep(fb565, rgbEncoded.data, rgbEncoded.offsets, i, 128 * 64);
    assert.deepEqual(fb565, packRgb565Frame(rgbSamples[i], 128, 64), `RGB565 frame ${i} bit-exact`);
  }
  const rgbHeaderRes = await exportMcuHeader(join(root, 'src/fx/sword/sword-qi-slash.js'), {
    profile: 'st7789-128x128',
    fps: 12,
    compress: 'rgb565-rle',
    out: join(dir, 'fx_sword_rgb565.h'),
  });
  assert.equal(rgbHeaderRes.width, 128);
  assert.equal(rgbHeaderRes.height, 128);
  const rgbHeaderText = await readFile(rgbHeaderRes.file, 'utf8');
  assert.match(rgbHeaderText, /oledfx_step_rgb565/);
  assert.ok(Object.keys(OLED_PROFILES).length >= 4);
});

test('All 32 catalog effects pass CHK-01..06, domain plugins, showcase grid, and Gallery session integration', async t => {
  const catalog = JSON.parse(await readFile(join(root, 'src/catalog.json'), 'utf8'));
  assert.equal(catalog.effects.length, 32);

  for (const entry of catalog.effects) {
    const file = join(root, entry.file);
    const report = await checkFX(file, { configFile: join(root, 'fx.config.example.js') });
    assert.equal(report.pass, true, `${entry.id} failed checkFX: ${JSON.stringify(report.checks)}`);

    // Verify OLED effects also pass oledShimmer and oledRLEBudget
    const mod = openEffect(entry.id);
    if (mod.meta.profile) {
      const fx = await loadFX(file);
      const run = sampleFX(fx, { seed: 42, fps: 24 });
      const ctx = { frames: run.frames, meta: fx.meta };
      assert.equal(oledShimmer().run(ctx).pass, true, `${entry.id} oledShimmer`);
      assert.equal(oledRLEBudget().run(ctx).pass, true, `${entry.id} oledRLEBudget`);
      assert.equal(inkEntropy().run(ctx).pass, true, `${entry.id} inkEntropy`);
    }

    // Verify public runtime & Gallery session support
    assert.ok(mod);
    const session = createGallerySession({ id: entry.id, seed: 42 });
    session.showFilledFrame();
    assert.ok(session.mcuHeader().includes('oledfx_step_frame'));
    assert.ok(session.snippet('react').includes(entry.id));
    assert.ok(session.snippet('vue').includes(entry.id));
  }
  assert.equal(Object.keys(effects).length, 32);

  // Verify 6x4 showcase grid generator
  const dir = await temporary(t);
  const grid = await renderShowcaseGrid({
    cols: 6,
    rows: 4,
    frameCount: 4,
    fps: 12,
    outGif: join(dir, 'grid.gif'),
    outPng: join(dir, 'grid.png'),
  });
  assert.equal(grid.cells, 24);
  assert.equal(grid.frames, 4);
  assert.ok(grid.gifBytes > 10000);
});
