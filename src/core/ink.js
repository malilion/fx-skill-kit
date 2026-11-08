import { hash2d, paperGrainMap } from './seed.js';
import { mineralRampColors, mineralRamps } from './palette.js';

const grainCache = new Map();
function getCachedGrain(w, h, seed, grainScale) {
  const key = `${w}x${h}:${seed >>> 0}:${grainScale}`;
  let grain = grainCache.get(key);
  if (!grain) {
    if (grainCache.size > 64) grainCache.clear();
    grain = paperGrainMap(w, h, seed, grainScale);
    grainCache.set(key, grain);
  }
  return grain;
}

export function createInkFrame(w, h, ox = w / 2, oy = h / 2, { seed = 1, grainScale = 5 } = {}) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 2 || h < 2) {
    throw new Error('InkFrame dimensions must be integers >= 2');
  }
  const size = w * h;
  return {
    w,
    h,
    ox,
    oy,
    pigment: new Float32Array(size),
    tint: new Uint8Array(size),
    wetness: new Float32Array(size),
    paperGrain: getCachedGrain(w, h, seed, grainScale),
    scratchPigment: new Float32Array(size),
    scratchWetness: new Float32Array(size),
  };
}

export function clearInkFrame(ink) {
  ink.pigment.fill(0);
  ink.tint.fill(0);
  ink.wetness.fill(0);
}

// Dry-brush (Feibai) algorithm from PRD 1.2 & 1.4:
// High speed or low wetness leaves paper grain valleys unpainted, forming fibrous streaks.
export function stampDryBrush(ink, cx, cy, radius, dryness = 0.2, intensity = 1, tintIdx = 0) {
  if (!(radius > 0) || !(intensity > 0)) return;
  const rCeil = Math.ceil(radius);
  const { w, h, ox, oy, pigment, wetness, tint, paperGrain } = ink;
  const dryClamped = Math.max(0, Math.min(1.2, dryness));
  const invRadius = 1 / (radius + 0.001);
  const r2 = radius * radius;
  const baseCx = Math.round(ox + cx);
  const baseCy = Math.round(oy + cy);
  const y0 = Math.max(1, baseCy - rCeil);
  const y1 = Math.min(h - 2, baseCy + rCeil);
  const x0 = Math.max(1, baseCx - rCeil);
  const x1 = Math.min(w - 2, baseCx + rCeil);

  for (let py = y0; py <= y1; py++) {
    const dy = py - baseCy;
    const dy2 = dy * dy;
    const row = py * w;
    for (let px = x0; px <= x1; px++) {
      const dx = px - baseCx;
      const d2 = dx * dx + dy2;
      if (d2 > r2) continue;
      const dist = Math.sqrt(d2);
      const idx = row + px;
      const fiberNoise = hash2d(px, py * 2) * 0.55 + paperGrain[idx] * 0.45;
      const falloff = 1 - dist * invRadius;
      if (falloff + (1 - dryClamped) * 0.18 - dryClamped * fiberNoise > 0.12) {
        const deposit = Math.min(1, falloff * intensity * 1.15);
        if (deposit > pigment[idx]) pigment[idx] = deposit;
        const wetDeposit = deposit * Math.max(0.05, 1 - dryClamped * 0.85);
        if (wetDeposit > wetness[idx]) wetness[idx] = wetDeposit;
        if (tintIdx > 0 && deposit > 0.18) tint[idx] = tintIdx;
      }
    }
  }
}

export function stampInkDrop(ink, cx, cy, radius, alpha = 1, tintIdx = 0) {
  stampDryBrush(ink, cx, cy, radius, 0.15, alpha, tintIdx);
}

export function stampInkStroke(ink, x0, y0, x1, y1, radius, dryness = 0.25, intensity = 1, tintIdx = 0) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / Math.max(0.75, radius * 0.4)));
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    stampDryBrush(ink, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, radius, dryness, intensity, tintIdx);
  }
}

// Wet Diffusion & Dark Fringe (水暈墨章) from PRD 1.2:
// Where wetness > threshold, pigment diffuses to 4-neighbors and deposits dark fringe at wet-dry borders.
export function stepInkDiffusion(ink, dt, {
  threshold = 0.08,
  diffusionRate = 0.22,
  fringeStrength = 0.14,
  dryRate = 0.38,
} = {}) {
  const { w, h, pigment, wetness, paperGrain, scratchPigment, scratchWetness } = ink;
  scratchPigment.set(pigment);
  scratchWetness.set(wetness);
  const stepScale = Math.min(1, dt * 60);
  const decay = Math.max(0, 1 - dryRate * dt);

  for (let y = 2; y < h - 2; y++) {
    const row = y * w;
    for (let x = 2; x < w - 2; x++) {
      const idx = row + x;
      const wet = scratchWetness[idx];
      if (wet <= threshold) {
        if (wet > 0) wetness[idx] = wet * decay;
        continue;
      }
      const n1 = scratchPigment[idx - 1];
      const n2 = scratchPigment[idx + 1];
      const n3 = scratchPigment[idx - w];
      const n4 = scratchPigment[idx + w];
      const avgPigment = (n1 + n2 + n3 + n4) * 0.25;
      const w1 = scratchWetness[idx - 1];
      const w2 = scratchWetness[idx + 1];
      const w3 = scratchWetness[idx - w];
      const w4 = scratchWetness[idx + w];
      const minNeighborWet = Math.min(w1, w2, w3, w4);

      const grainDamp = 0.65 + (1 - paperGrain[idx]) * 0.35;
      const diffused = scratchPigment[idx] + (avgPigment - scratchPigment[idx]) * diffusionRate * wet * grainDamp * stepScale;
      const boundary = Math.max(0, wet - minNeighborWet);
      const fringe = boundary > 0.06 ? boundary * fringeStrength * stepScale : 0;
      pigment[idx] = Math.min(1, Math.max(0, diffused + fringe));
      wetness[idx] = Math.min(1, (wet * 0.7 + (w1 + w2 + w3 + w4) * 0.075) * decay);
    }
  }
}

// Non-linear 6-stop mineral color ramp compositor from PRD 1.2:
// ramp = [0: paper/清, 1: 淡, 2: 重, 3: 濃, 4: 焦, 5: 點綴色/朱砂/鎏金]
export function compositeInkFrame(ink, rgbaFrame, {
  palette,
  defaultPalette = mineralRamps.songyan,
  paperBackground = false,
  grainRoughness = 1.0,
} = {}) {
  const ramp = mineralRampColors(palette, defaultPalette);
  const { w, h, pigment, wetness, tint, paperGrain } = ink;
  const out = rgbaFrame.data;
  const paper = ramp[0];
  const accent = ramp[5];
  const gold = [212, 175, 55];
  const total = w * h;

  for (let i = 0; i < total; i++) {
    const rawPigment = pigment[i];
    const wet = wetness[i];
    if (!paperBackground && rawPigment <= 0.004 && wet <= 0.02) continue;

    const outIdx = i * 4;
    const grain = (paperGrain[i] - 0.5) * 0.14 * grainRoughness;
    const effective = Math.max(0, Math.min(1, rawPigment + wet * 0.08 - Math.max(0, grain * (1 - wet))));

    if (effective <= 0.004) {
      if (paperBackground) {
        const gShift = Math.round((paperGrain[i] - 0.5) * 10 * grainRoughness);
        out[outIdx] = Math.max(0, Math.min(255, paper[0] + gShift));
        out[outIdx + 1] = Math.max(0, Math.min(255, paper[1] + gShift));
        out[outIdx + 2] = Math.max(0, Math.min(255, paper[2] + gShift));
        out[outIdx + 3] = 255;
      }
      continue;
    }

    // Fast non-linear curve approximation (x / (0.8 + 0.2 * x))
    const curved = effective / (0.82 + 0.18 * effective);
    const pos = Math.min(2.999, curved * 3);
    const stage = pos | 0;
    const frac = pos - stage;
    const c0 = ramp[stage + 1];
    const c1 = ramp[stage + 2];
    let r = c0[0] + (c1[0] - c0[0]) * frac;
    let g = c0[1] + (c1[1] - c0[1]) * frac;
    let b = c0[2] + (c1[2] - c0[2]) * frac;

    const channel = tint[i];
    if (channel === 1) {
      const mix = Math.min(1, 0.55 + effective * 0.45);
      r = r * (1 - mix) + accent[0] * mix;
      g = g * (1 - mix) + accent[1] * mix;
      b = b * (1 - mix) + accent[2] * mix;
    } else if (channel === 2) {
      const mix = Math.min(1, 0.65 + effective * 0.35);
      r = r * (1 - mix) + gold[0] * mix;
      g = g * (1 - mix) + gold[1] * mix;
      b = b * (1 - mix) + gold[2] * mix;
    }

    if (wet > 0.12 && effective > 0.15 && effective < 0.55) {
      const fringeDarken = 1 - wet * 0.18;
      r *= fringeDarken;
      g *= fringeDarken;
      b *= fringeDarken;
    }

    const alpha = Math.min(1, Math.sqrt(effective) * 0.35 + effective * 0.65);
    if (paperBackground) {
      const gShift = (paperGrain[i] - 0.5) * 8 * grainRoughness;
      const pr = Math.max(0, Math.min(255, paper[0] + gShift));
      const pg = Math.max(0, Math.min(255, paper[1] + gShift));
      const pb = Math.max(0, Math.min(255, paper[2] + gShift));
      out[outIdx] = (r * alpha + pr * (1 - alpha)) | 0;
      out[outIdx + 1] = (g * alpha + pg * (1 - alpha)) | 0;
      out[outIdx + 2] = (b * alpha + pb * (1 - alpha)) | 0;
      out[outIdx + 3] = 255;
    } else {
      out[outIdx] = r | 0;
      out[outIdx + 1] = g | 0;
      out[outIdx + 2] = b | 0;
      out[outIdx + 3] = Math.max(1, (alpha * 255) | 0);
    }
  }
}
