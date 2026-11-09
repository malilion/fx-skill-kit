import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, numberOption } from '../tools/cli.mjs';
import { callTool, createHandler } from '../tools/mcp-server.mjs';
import { scaffold } from '../tools/new.mjs';
import { decodeXorRleStep, decodeRgb565XorRleStep, formatBitmapHeader, formatRgb565Header, formatMcuHeader } from '../src/core/oled.js';
import { formatCHeader } from '../src/core/mask.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('security: cli parseArgs rejects prototype pollution and invalid numbers', () => {
  assert.throws(() => parseArgs(['--__proto__', 'polluted'], ['foo']), /Forbidden option/);
  assert.throws(() => parseArgs(['--constructor', 'polluted'], ['foo']), /Forbidden option/);
  assert.throws(() => parseArgs(['--prototype', 'polluted'], ['foo']), /Forbidden option/);

  const parsed = parseArgs(['--seed', '42'], ['seed']);
  assert.equal(numberOption(parsed.options, 'seed', 1), 42);
  assert.throws(() => numberOption({ seed: 'NaN' }, 'seed', 1), /must be a finite number/);
  assert.throws(() => numberOption({ seed: 'Infinity' }, 'seed', 1), /must be a finite number/);
  assert.throws(() => numberOption({ seed: 'not-a-number' }, 'seed', 1), /must be a finite number/);
});

test('security: new scaffold rejects reserved prototype identifiers', async () => {
  await assert.rejects(() => scaffold('constructor'), /must be lowercase kebab-case or category\/name/);
  await assert.rejects(() => scaffold('prototype'), /must be lowercase kebab-case or category\/name/);
  await assert.rejects(() => scaffold('toString'), /must be lowercase kebab-case or category\/name/);
  await assert.rejects(() => scaffold('valueOf'), /must be lowercase kebab-case or category\/name/);
});

test('security: MCP server blocks prototype pollution and illegal effect_ids', async () => {
  // Prototype property lookup attempt
  await assert.rejects(() => callTool('fx_run_diagnostics', { effect_id: 'pulse-dot', toString: 'bad' }), /Unknown argument|Forbidden argument/);

  // Path traversal attempt in effect_id
  await assert.rejects(() => callTool('fx_run_diagnostics', { effect_id: '../../package.json' }), /valid FX identifier/);

  // Non-existent catalog effect returns isError response gracefully
  const resUnknown = await callTool('fx_run_diagnostics', { effect_id: 'non-existent-effect' });
  assert.equal(resUnknown.isError, true);
  assert.match(resUnknown.content[0].text, /Unknown effect_id/);
});

test('security: MCP handler validates JSON-RPC params structure', async () => {
  const handler = createHandler();
  // Array params when object expected
  const badParams = await handler({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: [1, 2, 3] });
  assert.equal(badParams.error.code, -32600);

  // Primitive params when object expected
  const primParams = await handler({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: 'invalid' });
  assert.equal(primParams.error.code, -32600);
});

test('security: C header generators sanitize symbol identifiers and decoders check bounds', () => {
  const dummyFrames = [{ w: 16, h: 16, data: new Uint8ClampedArray(16 * 16 * 4) }];
  const header1 = formatCHeader({ id: 'bad;name/*inject*/\n#error', w: 16, h: 16, frames: dummyFrames, dt: 0.1, seed: 1 });
  assert.match(header1, /#define FX_BAD_NAME__INJECT____ERROR_W 16/);
  assert.doesNotMatch(header1, /\/\*inject\*\//);

  const mcuHeader = formatMcuHeader({ id: 'pulse;drop', profile: 'ssd1306-128x64', w: 128, h: 64, fps: 24, frames: dummyFrames });
  assert.match(mcuHeader, /if \(!fb_1024 \|\| frame_idx >= 1u\) return;/);

  const rgbHeader = formatRgb565Header({ id: 'laser;hack', profile: 'st7789-128x128', w: 128, h: 128, fps: 24, frames: dummyFrames });
  assert.match(rgbHeader, /if \(!fb_px \|\| frame_idx >= 1u\) return;/);

  // Reference decoders do not throw on null fb or out-of-bounds frame index
  assert.equal(decodeXorRleStep(null, [0], [0], 0), null);
  const fb = new Uint8Array(10);
  assert.equal(decodeXorRleStep(fb, [0], [0], 99), fb);

  assert.equal(decodeRgb565XorRleStep(null, [0], [0], 0), null);
  const fb16 = new Uint16Array(10);
  assert.equal(decodeRgb565XorRleStep(fb16, [0], [0], 99), fb16);
});

test('security: static web server security headers and path traversal defenses', async (t) => {
  let child;
  const bootServer = () => new Promise((resolve, reject) => {
    child = spawn('node', ['gallery/serve.mjs'], {
      cwd: root,
      env: { ...process.env, PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`gallery did not start:\n${output}`));
    }, 8000);
    const onData = chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)\/gallery\//);
      if (!match || settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Number(match[1]));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', code => {
      if (!settled) { settled = true; clearTimeout(timer); reject(new Error(`gallery exited code ${code}`)); }
    });
  });

  let port;
  try {
    port = await bootServer();
  } catch (err) {
    if (err.message?.includes('EPERM') || err.message?.includes('listen')) {
      t.skip('Skipping HTTP socket test in sandboxed environment');
      return;
    }
    throw err;
  }
  t.after(() => { try { child.kill('SIGTERM'); } catch {} });

  // 1. Verify standard page has security headers
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${port}/gallery/`);
  } catch (err) {
    if (err.cause?.code === 'EPERM' || err.code === 'EPERM') {
      t.skip('Skipping loopback socket fetch in sandboxed environment');
      return;
    }
    throw err;
  }
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);

  // 2. Verify path traversal rejection
  const resTrav = await fetch(`http://127.0.0.1:${port}/gallery/../../package.json`);
  assert.equal(resTrav.status, 404);

  // 3. Verify null-byte rejection
  const resNull = await fetch(`http://127.0.0.1:${port}/gallery/%00/index.html`);
  assert.equal(resNull.status, 400);

  // 4. Verify dotfile access rejection
  const resDot = await fetch(`http://127.0.0.1:${port}/gallery/.git/config`);
  assert.equal(resDot.status, 404);

  // 5. Verify disallowed directories rejection
  const resDisallowed = await fetch(`http://127.0.0.1:${port}/records/`);
  assert.equal(resDisallowed.status, 404);

  // 6. Verify non-GET/HEAD method rejection
  const resPost = await fetch(`http://127.0.0.1:${port}/gallery/`, { method: 'POST' });
  assert.equal(resPost.status, 405);
  assert.equal(resPost.headers.get('allow'), 'GET, HEAD');
});
