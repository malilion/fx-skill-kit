import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { inflateSync } from 'node:zlib';
import { renderFX, main as renderMain } from '../tools/render.mjs';
import { checkFX, main as checkMain } from '../tools/check.mjs';
import { exportAsset } from '../tools/export.mjs';
import { scaffold } from '../tools/new.mjs';
import { callTool, createHandler, toolSchemas, serve } from '../tools/mcp-server.mjs';
import { encodeGIF } from '../src/core/gif.js';
import { loadFX, sampleFX, withoutMathRandom } from '../src/core/run.js';
import { inkEntropy, oledShimmer, oledRLEBudget } from '../src/checks/domain.js';

// Performance limits have dedicated deterministic/slow-frame tests in phase1.
// Keep image, protocol, and export correctness independent of host scheduling.
const originalPerfEnv = process.env.FX_CHECK_PERF;
process.env.FX_CHECK_PERF = '0';
after(() => {
  if (originalPerfEnv === undefined) delete process.env.FX_CHECK_PERF;
  else process.env.FX_CHECK_PERF = originalPerfEnv;
});

async function temporary(t) {
  const dir = await mkdtemp(resolve('.fx-full-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const example = resolve('examples/fx/orbit-loop.js');
const text = result => JSON.parse(result.content[0].text);
function pngPixels(buffer) {
  const w = buffer.readUInt32BE(16), h = buffer.readUInt32BE(20), compressed = [];
  for (let pos = 8; pos < buffer.length;) {
    const length = buffer.readUInt32BE(pos);
    if (buffer.toString('ascii', pos + 4, pos + 8) === 'IDAT') compressed.push(buffer.subarray(pos + 8, pos + 8 + length));
    pos += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(compressed)), data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    assert.equal(raw[y * (w * 4 + 1)], 0);
    raw.copy(data, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1));
  }
  return { w, h, data };
}
// Independent decoder, including dictionary expansion and variable-width LZW.
function decodeGIF(bytes) {
  assert.equal(bytes.toString('ascii', 0, 6), 'GIF89a');
  const w = bytes.readUInt16LE(6), h = bytes.readUInt16LE(8);
  const colors = 2 ** ((bytes[10] & 7) + 1);
  const palette = bytes.subarray(13, 13 + colors * 3);
  let pos = 13 + colors * 3, control, loop = false;
  const frames = [];
  const blocks = () => {
    const chunks = [];
    while (bytes[pos]) { const size = bytes[pos++]; chunks.push(bytes.subarray(pos, pos + size)); pos += size; }
    pos++;
    return Buffer.concat(chunks);
  };
  while (bytes[pos] !== 0x3b) {
    const tag = bytes[pos++];
    if (tag === 0x21) {
      const label = bytes[pos++];
      if (label === 0xf9) {
        assert.equal(bytes[pos++], 4);
        control = { flags: bytes[pos++], delay: bytes.readUInt16LE(pos), transparent: bytes[pos + 2] }; pos += 4;
      } else if (label === 0xff) {
        const size = bytes[pos++], name = bytes.toString('ascii', pos, pos + size); pos += size;
        const data = blocks(); loop = name === 'NETSCAPE2.0' && data.readUInt16LE(1) === 0;
      } else blocks();
      continue;
    }
    assert.equal(tag, 0x2c);
    const fw = bytes.readUInt16LE(pos + 4), fh = bytes.readUInt16LE(pos + 6);
    assert.equal(bytes[pos + 8], 0); pos += 9;
    const minimum = bytes[pos++], compressed = blocks(), clear = 1 << minimum, end = clear + 1;
    let bits = minimum + 1, bit = 0, dict, previous;
    const reset = () => { dict = Array.from({ length: end + 1 }, (_, i) => [i]); bits = minimum + 1; previous = null; };
    reset();
    const pixels = [];
    while (true) {
      let code = 0;
      for (let i = 0; i < bits; i++, bit++) code |= ((compressed[bit >> 3] >> (bit & 7)) & 1) << i;
      if (code === clear) { reset(); continue; }
      if (code === end) break;
      const entry = dict[code] ?? [...previous, previous[0]];
      pixels.push(...entry);
      if (previous) {
        dict.push([...previous, entry[0]]);
        if (dict.length === 1 << bits && bits < 12) bits++;
      }
      previous = entry;
      assert.ok(bit <= compressed.length * 8, 'LZW terminates within buffer');
    }
    assert.equal(pixels.length, fw * fh);
    frames.push({ pixels, ...control });
  }
  assert.equal(pos, bytes.length - 1);
  return { w, h, palette, loop, frames };
}

test('sheet atlas contains exact transparent source pixels without guides; CLI emits all exports', async t => {
  const dir = await temporary(t);
  const result = await renderFX(example, { seed: 42, fps: 12, columns: 4, outDir: dir, sheet: true, gif: true });
  const atlas = JSON.parse(await readFile(result.sprite.json));
  const image = pngPixels(await readFile(result.sprite.png));
  const run = sampleFX(await loadFX(example), { seed: 42, fps: 12 });
  assert.equal(atlas.frames.length, run.frames.length - 1, 'loop endpoint omitted');
  assert.equal(atlas.meta.image, 'sheet.png');
  atlas.frames.forEach(({ frame, duration }, fi) => {
    assert.ok(duration > 0);
    for (let y = 0; y < frame.h; y++) {
      const row = image.data.subarray(((frame.y + y) * image.w + frame.x) * 4, ((frame.y + y) * image.w + frame.x + frame.w) * 4);
      assert.deepEqual(row, Buffer.from(run.frames[fi].data.subarray(y * frame.w * 4, (y + 1) * frame.w * 4)));
    }
  });
  assert.deepEqual(Array.from(image.data.subarray(0, 4)), [0, 0, 0, 0]);
  const gif = decodeGIF(await readFile(result.gif));
  assert.equal(gif.frames.length, atlas.frames.length);
  assert.equal(gif.loop, true);
  assert.equal(gif.frames.reduce((sum, f) => sum + f.delay, 0), 200);
  const lines = [];
  await renderMain(['pulse-dot', '--sheet', '--gif', '--palette', 'zhusha', '--out', join(dir, 'cli')], { log: s => lines.push(s) });
  assert.match(lines.join(''), /sheet.json/);
  assert.match(lines.join(''), /preview.gif/);
});

test('GIF decodes transparency, palette, disposal, non-loop timing, and multiple LZW clear blocks', () => {
  const data = new Uint8ClampedArray(20 * 20 * 4);
  for (let p = 1; p < 400; p++) data.set([255, 0, 51, 255], p * 4);
  const gif = decodeGIF(encodeGIF({ w: 20, h: 20, fps: 12, frames: [{ data }, { data }] }));
  assert.equal(gif.loop, false);
  for (const frame of gif.frames) {
    assert.equal((frame.flags >> 2) & 7, 2, 'restore transparent background between frames');
    assert.equal(frame.flags & 1, 1);
    assert.equal(frame.pixels[0], frame.transparent);
    for (const pixel of frame.pixels.slice(1)) assert.deepEqual(Array.from(gif.palette.subarray(pixel * 3, pixel * 3 + 3)), [255, 0, 51]);
  }
  assert.equal(gif.frames.reduce((sum, f) => sum + f.delay, 0), 17);
  assert.throws(() => encodeGIF({ w: 20, h: 20, frames: [] }), /Invalid GIF/);
});

test('palette options affect baked output; multi-angle forwards both tilt parameters', async t => {
  const dir = await temporary(t);
  const normal = await renderFX(example, { outDir: join(dir, 'normal') });
  const colored = await renderFX(example, { palette: 'zhusha', outDir: join(dir, 'colored') });
  assert.notEqual(normal.stats.hash, colored.stats.hash);
  await assert.rejects(renderFX(example, { palette: 'invalid', outDir: dir }), /Palette/);
  const file = join(dir, 'angle.js');
  await writeFile(file, `export const meta={id:'angle',w:8,h:8,ox:4,oy:4,duration:1,loop:false};
    export function create({tiltX=0,tiltY=0}){return {t:0,step(dt){this.t+=dt},draw(f){f.data.set([(tiltX+1)*100,(tiltY+1)*100,0,255],144)}}}`);
  const result = await renderFX(file, { multiAngle: true, outDir: dir });
  assert.equal(result.angles.stats.frameCount, 9);
  assert.deepEqual(result.angles.stats.frames.map(f => [f.tiltX, f.tiltY]), [-1,0,1].flatMap(y => [-1,0,1].map(x => [x,y])));
});

test('C export contains exact page-packed alpha masks and portable declarations', async t => {
  const dir = await temporary(t);
  const file = join(dir, 'mask.js');
  await writeFile(file, `export const meta={id:'ui/mask',w:2,h:9,ox:1,oy:4,duration:0.1,loop:false};
    export function create(){return {t:0,step(dt){this.t+=dt},draw(f){for(const p of [0,16,17])f.data.set([0,0,0,255],p*4)}}}`);
  const result = await exportAsset(file, 'c-header', { outDir: dir });
  const header = await readFile(result.files[0], 'utf8');
  assert.match(header, /FX_UI_MASK_FRAME_BYTES 4/);
  const bytes = [...header.matchAll(/0x([0-9a-f]{2})/g)].map(m => parseInt(m[1], 16));
  assert.deepEqual(bytes, Array.from({ length: result.frames }, () => [1,0,1,1]).flat());
  await assert.rejects(exportAsset(file, 'not-supported', { outDir: dir }), /target_format/);
});

test('CHK-03 detects pre-endpoint jumps even if exact endpoints match, and checks centroid', async t => {
  const dir = await temporary(t), file = join(dir, 'seam.js');
  await writeFile(file, `export const meta={id:'seam',duration:1,loop:true,w:64,h:64,ox:32,oy:32};
    export function create(){return {t:0,step(dt){this.t+=dt},draw(f){
      const x=this.t>0.95 && this.t<0.999 ? 45:10; for(let y=20;y<24;y++)for(let dx=0;dx<4;dx++)f.data.set([0,0,0,255],(y*64+x+dx)*4);
    }}}`);
  const report = await checkFX(file);
  const seam = report.checks.find(c => c.id === 'CHK-03');
  assert.equal(seam.pass, false);
  assert.ok(Math.abs(seam.runs[0].time - (1 - 1/30)) < 1e-10);
  assert.ok(seam.runs[0].centroidShift > seam.runs[0].centroidLimit);
  const output = [];
  const exitCode = process.exitCode;
  await checkMain([file, '--json'], { log: s => output.push(s) });
  assert.equal(process.exitCode, 1); process.exitCode = exitCode;
  assert.equal(JSON.parse(output[0])[0].checks.length, 6);
});

test('real ink entropy, OLED shimmer, and XOR-RLE budget plugins reject domain defects', () => {
  const makeFrame = () => ({ data: new Uint8ClampedArray(8 * 8 * 4) });
  const off = makeFrame(), dot = makeFrame(); dot.data.set([0,0,0,255], (3*8+3)*4);
  const ctx = { frames: [off, dot, off], meta: { w:8, h:8, loop:false } };
  assert.equal(inkEntropy().run(ctx).pass, false, 'solid black has zero tonal entropy');
  const gradient = makeFrame();
  for (let i=0;i<64;i++) gradient.data.set([0,0,0,Math.round((i+1)/64*255)],i*4);
  assert.equal(inkEntropy().run({ ...ctx, frames: [gradient] }).pass, true);
  assert.equal(oledShimmer().run(ctx).pass, false);
  assert.equal(oledShimmer().run({ ...ctx, frames: [dot,dot,dot] }).pass, true);
  assert.equal(oledRLEBudget({maxBytes:1}).run(ctx).pass, false);
  assert.equal(oledRLEBudget().run(ctx).pass, true);
});

test('concurrent tool consumers serialize the global guards and restore them on failures', async () => {
  const random = Math.random, now = Date.now;
  const settled = await Promise.allSettled([
    withoutMathRandom(async () => { await new Promise(r => setTimeout(r, 10)); Date.now(); }),
    withoutMathRandom(async () => { assert.throws(() => Math.random(), /forbidden/); return 42; }),
  ]);
  assert.equal(settled[0].status, 'rejected');
  assert.equal(settled[1].value, 42);
  assert.equal(Math.random, random); assert.equal(Date.now, now);
});

test('Sim assets always step at 120Hz and produce identical state at shared display times', () => {
  const fx = { meta: { id:'sim', duration:1, loop:false, sim:true, w:4,h:4,ox:2,oy:2 }, create() {
    return {t:0,x:1,step(dt){assert.equal(dt,1/120);this.t+=dt;this.x*=1.001;},draw(f){f.data.set([Math.round(this.x*100),0,0,255],20)}};
  }};
  const a=sampleFX(fx,{fps:24}), b=sampleFX(fx,{fps:60});
  assert.equal(a.simulationHz,120);
  for(const time of [0,0.5,1]) {
    assert.deepEqual(a.frames.find(f=>f.time===time).data,b.frames.find(f=>f.time===time).data);
  }
  const offGrid=sampleFX({...fx,meta:{...fx.meta,duration:0.213}},{fps:31});
  assert.equal(offGrid.frames.at(-1).time,0.213);
  assert.equal(offGrid.frames.at(-1).simulationTime,25/120);
});

test('MCP lists four schemas and executes search, image, diagnostics and each export locally', async t => {
  const dir = await temporary(t);
  const file = await scaffold('ui/mcp-pulse', join(dir, 'fx'), { catalogFile: join(dir, 'catalog.json'), loop: true });
  const opts = { catalogFile: join(dir, 'catalog.json'), outDir: join(dir, 'out') };
  assert.equal(toolSchemas.length, 4);
  const search = text(await callTool('fx_search_catalog', { query: 'pulse', category: 'ui' }, opts));
  assert.equal(search.effects[0].id, 'ui/mcp-pulse');
  assert.equal(text(await callTool('fx_search_catalog', { query: 'missing' }, opts)).effects.length, 0);
  const image = await callTool('fx_render_contact_sheet', { effect_id: 'ui/mcp-pulse', palette: ['#c83228'] }, opts);
  assert.equal(image.content[0].type, 'image');
  assert.equal(pngPixels(Buffer.from(image.content[0].data, 'base64')).w > 0, true);
  const report = text(await callTool('fx_run_diagnostics', { effect_id: 'ui/mcp-pulse' }, opts));
  assert.equal(report.pass, true, JSON.stringify(report));
  assert.equal(report.checks.length, 6);
  for (const format of ['sheet','gif','png','c-header']) {
    const result = text(await callTool('fx_export_asset', { effect_id: 'ui/mcp-pulse', target_format: format }, opts));
    assert.equal(result.format, format);
    for (const path of result.files) assert.ok((await readFile(path)).length > 0);
  }
  await assert.rejects(callTool('unknown', {}, opts), /Unknown tool/);
  await assert.rejects(callTool('fx_run_diagnostics', {}, opts), /Missing effect_id/);
  await assert.rejects(callTool('fx_run_diagnostics', { effect_id: 3 }, opts), /Invalid effect_id/);
  assert.equal((await callTool('fx_run_diagnostics', { effect_id: 'missing' }, opts)).isError, true);
  assert.equal((await loadFX(file)).meta.id, 'ui/mcp-pulse');
});

test('MCP JSON-RPC lifecycle, errors, notification silence, and stream framing', async () => {
  const handle = createHandler();
  const request = (id, method, params) => ({jsonrpc:'2.0', id, method, params});
  assert.equal((await handle(request(1,'tools/list'))).error.code,-32000);
  assert.equal((await handle(request(2,'initialize',{protocolVersion:'2025-11-25'}))).result.protocolVersion,'2025-11-25');
  assert.equal(await handle({jsonrpc:'2.0',method:'notifications/initialized'}),undefined);
  assert.equal((await handle(request(3,'tools/list'))).result.tools.length,4);
  assert.equal((await handle(request(4,'tools/call',{name:'missing'}))).error.code,-32602);
  assert.equal((await handle(request(5,'missing'))).error.code,-32601);
  assert.equal((await handle([])).error.code,-32600);
  let stdout='';
  const output = new Writable({write(chunk, encoding, done){stdout+=chunk;done()}});
  const wire = ['broken-json', JSON.stringify(request(1,'initialize',{protocolVersion:'2025-11-25'})),
    JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}), JSON.stringify(request(2,'tools/list')),
    JSON.stringify(request(3,'tools/call',{name:'fx_search_catalog',arguments:{query:'orbit'}}))].join('\n')+'\n';
  await serve({ input: Readable.from([wire.slice(0,41),wire.slice(41)]), output });
  const responses=stdout.trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(responses.length,4);
  assert.equal(responses[0].error.code,-32700);
  assert.equal(responses[2].result.tools.length,4);
  assert.equal(text(responses[3].result).effects[0].id,'orbit-loop');
});
