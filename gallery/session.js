import { effects } from '../src/index.js';
import { createFrame, clear } from '../src/core/frame.js';
import { formatCHeader } from '../src/core/mask.js';
import { encodeFramePNG } from '../src/core/png-bytes.js';

const sourceUrls = {
  'pulse-dot': new URL('../examples/fx/pulse-dot.js', import.meta.url),
  'orbit-loop': new URL('../examples/fx/orbit-loop.js', import.meta.url),
};

export async function copyEffectSource(id) {
  const url = sourceUrls[id];
  if (!url) throw new Error(`Unknown effect: ${id}`);
  if (url.protocol !== 'file:') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot read source for ${id} (${response.status})`);
    return response.text();
  }
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  return readFile(fileURLToPath(url), 'utf8');
}

function timing(meta) {
  const hz = meta.sim ? 120 : 60;
  const ticks = Math.ceil(meta.duration * hz);
  return { ticks, dt: meta.sim ? 1 / 120 : meta.duration / ticks };
}

function visibleCount(frame) {
  let count = 0;
  const data = frame.data;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 16) count++;
  return count;
}

export function createGallerySession({ id = 'pulse-dot', seed = 1, palette = '', tiltX = 0, tiltY = 0 } = {}) {
  const state = {
    id, seed, palette, tiltX, tiltY, paused: false, accumulator: 0,
    tick: 0, ticks: 1, dt: 1 / 60, fx: null, frame: null, module: null,
  };

  function spawn(tick) {
    state.module = effects[state.id];
    if (!state.module) throw new Error(`Unknown effect: ${state.id}`);
    const { ticks, dt } = timing(state.module.meta);
    state.ticks = ticks;
    state.dt = dt;
    const palette = state.palette === '' || state.palette == null ? undefined : state.palette;
    state.fx = state.module.create({
      seed: state.seed, palette, tiltX: state.tiltX, tiltY: state.tiltY,
    });
    const meta = state.module.meta;
    state.frame = createFrame(meta.w, meta.h, meta.ox, meta.oy);
    const steps = Math.max(0, Math.min(tick, ticks));
    for (let i = 0; i < steps; i++) state.fx.step(dt);
    state.tick = steps;
    clear(state.frame);
    state.fx.draw(state.frame);
  }

  spawn(0);

  return {
    get id() { return state.id; },
    get frame() { return state.frame; },
    get meta() { return state.module.meta; },
    get tick() { return state.tick; },
    get dt() { return state.dt; },
    get paused() { return state.paused; },
    setPaused(paused) { state.paused = paused; },
    setEffect(next) {
      state.id = next;
      state.accumulator = 0;
      spawn(0);
    },
    setSeed(seed) {
      state.seed = seed;
      spawn(state.tick);
    },
    setPalette(palette) {
      state.palette = palette;
      spawn(state.tick);
    },
    setTilt(tiltX, tiltY) {
      state.tiltX = tiltX;
      state.tiltY = tiltY;
      spawn(state.tick);
    },
    get ended() {
      return !state.module.meta.loop && state.tick >= state.ticks;
    },
    holdEnded() {
      if (!this.ended || state.paused) return false;
      state.paused = true;
      return true;
    },
    advance(seconds) {
      if (state.paused) return;
      state.accumulator += Math.min(Math.max(0, seconds), 0.1);
      while (state.accumulator >= state.dt) {
        // One-shots hold the last frame. Loops restart from the same seed.
        if (state.tick >= state.ticks) {
          if (!state.module.meta.loop) {
            state.accumulator = 0;
            break;
          }
          spawn(0);
        }
        state.accumulator -= state.dt;
        state.fx.step(state.dt);
        state.tick += 1;
      }
      clear(state.frame);
      state.fx.draw(state.frame);
    },
    showFilledFrame() {
      const paused = state.paused;
      state.paused = false;
      state.accumulator = 0;
      spawn(0);
      let bestTick = state.tick;
      let bestCount = visibleCount(state.frame);
      const cap = Math.ceil(state.module.meta.duration / state.dt) + 2;
      for (let guard = 0; guard < cap; guard++) {
        const tick = state.tick;
        this.advance(state.dt);
        if (state.tick === tick) break;
        const count = visibleCount(state.frame);
        if (count > bestCount) {
          bestCount = count;
          bestTick = state.tick;
        }
      }
      state.accumulator = 0;
      spawn(bestTick);
      state.paused = paused;
    },
    async copySource() { return copyEffectSource(state.id); },
    png() { return encodeFramePNG(state.frame); },
    header() {
      return formatCHeader({
        id: state.module.meta.id,
        w: state.frame.w,
        h: state.frame.h,
        frames: [state.frame],
        dt: state.dt,
        seed: state.seed,
      });
    },
  };
}
