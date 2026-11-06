import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createFrame, clear } from './frame.js';

let imports = 0;
export async function loadFX(file) {
  const url = pathToFileURL(resolve(file));
  url.searchParams.set('run', String(++imports)); // Reset entry-module state for every run.
  const fx = await import(url.href);
  const m = fx.meta;
  if (!m || typeof m.id !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(m.id) || typeof m.loop !== 'boolean' ||
      !Number.isFinite(m.duration) || m.duration <= 0 ||
      !Number.isInteger(m.w) || !Number.isInteger(m.h) || m.w < 2 || m.h < 2 ||
      !Number.isFinite(m.ox) || !Number.isFinite(m.oy) ||
      m.ox < 0 || m.ox >= m.w || m.oy < 0 || m.oy >= m.h || typeof fx.create !== 'function') {
    throw new Error('FX must export valid meta {id,duration,loop,w,h,ox,oy} and create(opts)');
  }
  return fx;
}

export function pixelStats(frame) {
  let filled = 0;
  let edge = 0;
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      if (frame.data[(y * frame.w + x) * 4 + 3] === 0) continue;
      filled++;
      if (x === 0 || y === 0 || x === frame.w - 1 || y === frame.h - 1) edge++;
    }
  }
  return { fillRatio: filled / (frame.w * frame.h), edgeRatio: edge / (2 * frame.w + 2 * frame.h - 4) };
}

export function mse(a, b) {
  if (a.length !== b.length || a.length === 0) throw new Error('MSE needs equal nonempty buffers');
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return sum / a.length;
}

export function sampleFX(fx, { seed = 1, fps = 30 } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be a uint32');
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240) throw new Error('fps must be > 0 and <= 240');
  const { meta } = fx;
  const steps = Math.ceil(meta.duration * fps);
  const dt = meta.duration / steps; // Constant dt, including exact t=0 and t=duration.
  const effect = fx.create({ seed });
  if (!effect || effect.t !== 0 || typeof effect.step !== 'function' || typeof effect.draw !== 'function') {
    throw new Error('create(opts) must return {t:0, step(dt), draw(frame)}');
  }
  const frame = createFrame(meta.w, meta.h, meta.ox, meta.oy);
  const hash = createHash('sha256');
  const frames = [];
  for (let index = 0; index <= steps; index++) {
    if (index) effect.step(dt);
    const time = index === steps ? meta.duration : index * dt;
    if (!Number.isFinite(effect.t) || Math.abs(effect.t - time) > 1e-8 * Math.max(1, time)) {
      throw new Error('step(dt) must advance t by dt');
    }
    clear(frame);
    effect.draw(frame);
    hash.update(frame.data);
    frames.push({ index, time, ...pixelStats(frame), data: frame.data.slice() });
  }
  return { meta, seed, fps, dt, frames, hash: hash.digest('hex') };
}

export async function withoutMathRandom(fn) {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random is forbidden; use a seeded PRNG'); };
  try { return await fn(); } finally { Math.random = original; }
}
