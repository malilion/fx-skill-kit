import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createFrame, clear } from './frame.js';

let imports = 0;
export const validId = id => typeof id === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$/.test(id);

export async function loadFX(file) {
  const url = pathToFileURL(resolve(file));
  url.searchParams.set('run', String(++imports)); // Reset entry-module state for every run.
  const fx = await import(url.href);
  const m = fx.meta;
  if (!m || !validId(m.id) || typeof m.loop !== 'boolean' ||
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

export function sampleFX(fx, { seed = 1, fps = 30, startTime = 0, endTime = fx.meta.duration, fixedFps = false } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be a uint32');
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240) throw new Error('fps must be > 0 and <= 240');
  const { meta } = fx;
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) throw new Error('Invalid sample timeline');
  const steps = Math.ceil((endTime - startTime) * fps);
  const dt = fixedFps ? 1 / fps : (endTime - startTime) / steps;
  const effect = fx.create({ seed });
  if (!effect || effect.t !== 0 || typeof effect.step !== 'function' || typeof effect.draw !== 'function') {
    throw new Error('create(opts) must return {t:0, step(dt), draw(frame)}');
  }
  effect.t = startTime;
  const frame = createFrame(meta.w, meta.h, meta.ox, meta.oy);
  const hash = createHash('sha256');
  const frames = [];
  for (let index = 0; index <= steps; index++) {
    const time = index === steps ? endTime : startTime + index * dt;
    const previous = startTime + (index - 1) * dt;
    if (index) effect.step(fixedFps && index === steps ? time - previous : dt);
    if (!Number.isFinite(effect.t) || Math.abs(effect.t - time) > 1e-8 * Math.max(1, Math.abs(time))) {
      throw new Error('step(dt) must advance t by dt');
    }
    clear(frame);
    effect.draw(frame);
    hash.update(frame.data);
    frames.push({ index, time, ...pixelStats(frame), data: frame.data.slice() });
  }
  return { meta, seed, fps, dt, timeline: { start: startTime, end: endTime, fixedFps }, frames, hash: hash.digest('hex') };
}

// Retain the original public name for callers; guard all unseeded time sources too.
export async function withoutMathRandom(fn) {
  const original = Math.random;
  const originalDate = Date.now;
  const clock = globalThis.performance;
  const originalPerformance = clock && Object.getOwnPropertyDescriptor(clock, 'now');
  Math.random = () => { throw new Error('Math.random is forbidden; use a seeded PRNG'); };
  Date.now = () => { throw new Error('Date.now is forbidden; use simulation time and a seeded PRNG'); };
  try {
    if (clock) Object.defineProperty(clock, 'now', { configurable: true, value: () => {
      throw new Error('performance.now is forbidden in FX; use simulation time and a seeded PRNG');
    } });
    return await fn();
  } finally {
    Math.random = original;
    Date.now = originalDate;
    if (clock) {
      if (originalPerformance) Object.defineProperty(clock, 'now', originalPerformance);
      else delete clock.now;
    }
  }
}
