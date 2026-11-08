// PRD 01 Section 1.4 PoC Reference Implementation: 水墨劍氣斬擊 (sword-qi-slash.js)
import { mulberry32 } from '../../core/seed.js';
import {
  createInkFrame,
  clearInkFrame,
  stampDryBrush,
  stampInkDrop,
  stepInkDiffusion,
  compositeInkFrame,
} from '../../core/ink.js';
import { viewPoint } from '../../core/view.js';

export const meta = {
  id: 'sword/sword-qi-slash',
  category: 'sword',
  duration: 0.75,
  loop: false,
  sim: true,
  w: 160,
  h: 160,
  ox: 80,
  oy: 80,
  defaultPalette: ['#f4efe6', '#c9c2b8', '#7d766d', '#3b3734', '#161412', '#b82921'],
};

export const act = {
  windup: 0.4,
  poses: [
    [-0.40, 'SHEATH_CROUCH'],     // 壓身按劍
    [-0.08, 'EYE_GLINT', 'snap'], // 寒光一閃（朱砂色十字微光）
    [0.00,  'DRAW_CUT', 'snap'],  // 拔刀極速斬出
    [0.08,  'FOLLOW_HOLD'],       // 殘心定格
    [0.65,  'STAND_RECOVER'],     // 收刀立定
  ],
  hits: [{ t: 0.04, freeze: 0.15, shakeAmp: 3, inkSplash: 24 }],
  recovery: 0.1,
};

export function create(opts = {}) {
  const seed = opts.seed ?? 1024;
  const rand = mulberry32(seed);
  const ink = createInkFrame(meta.w, meta.h, meta.ox, meta.oy, { seed });

  const droplets = Array.from({ length: 28 }, () => {
    const angle = -0.35 + (rand() - 0.5) * 0.65;
    const speed = 90 + rand() * 165;
    return {
      x: -28 + rand() * 20,
      y: 8 + (rand() - 0.5) * 12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1.4 + rand() * 2.6,
      life: 0.32 + rand() * 0.42,
      age: 0,
      isCinnabar: rand() < 0.22,
    };
  });

  return {
    t: 0,
    step(dt) {
      this.t += dt;
      if (this.t < 0) return;
      for (const d of droplets) {
        if (this.t < 0.015) continue;
        // Respect hit-stop freeze window (0.04s .. 0.19s) with damped micro-motion
        const freezeScale = this.t >= 0.04 && this.t < 0.19 ? 0.18 : 1;
        const stepDt = dt * freezeScale;
        d.age += stepDt;
        d.x += d.vx * stepDt;
        d.y += d.vy * stepDt;
        d.vx *= Math.pow(0.91, freezeScale);
        d.vy = d.vy * Math.pow(0.91, freezeScale) + 18 * stepDt;
      }
    },
    draw(frame) {
      clearInkFrame(ink);
      const origin = viewPoint(0, 0, opts.tiltX, opts.tiltY, 10, 8);
      ink.ox = meta.ox + origin.x;
      ink.oy = meta.oy + origin.y;

      // Windup phase (t < 0): sheath crouch qi condensation & cinnabar eye glint
      if (this.t < 0) {
        const wProg = Math.max(0, 1 + this.t / act.windup);
        const coreR = 3.5 + wProg * 5.5;
        stampDryBrush(ink, -36, 16, coreR, 0.25, 0.45 + 0.4 * wProg, 0);
        if (this.t >= -0.12) {
          const glint = 1 - Math.abs(this.t + 0.05) / 0.08;
          if (glint > 0) {
            const len = 6 + glint * 14;
            for (let s = -len; s <= len; s += 1.5) {
              stampDryBrush(ink, -36 + s, 16, 1.6, 0.05, glint * 0.95, 1);
              stampDryBrush(ink, -36, 16 + s * 0.7, 1.4, 0.05, glint * 0.95, 1);
            }
          }
        }
        compositeInkFrame(ink, frame, { palette: opts.palette, defaultPalette: meta.defaultPalette });
        return;
      }

      // Active slash & recovery
      const progress = Math.min(1, (this.t + 0.02) / 0.11);
      const fade = Math.max(0.08, 1 - Math.max(0, this.t - 0.18) / 0.62);

      // 1. Main sword-qi arc with dry-brush feibai texture
      const steps = Math.max(6, Math.floor(64 * progress));
      for (let i = 0; i <= steps; i++) {
        const u = i / 64;
        const arcX = -46 + u * 96;
        const arcY = 20 - Math.sin(u * Math.PI * 0.85) * 36;
        const thickness = (1.5 + Math.sin(u * Math.PI) * 6.8) * (0.42 + 0.58 * fade);
        const dryness = u * 0.72 + (1 - fade) * 0.32;
        stampDryBrush(ink, arcX, arcY, thickness, dryness, fade, u > 0.78 ? 1 : 0);
      }

      // 2. Impact cinnabar core flash during hit-stop
      if (this.t >= 0.02 && this.t <= 0.24) {
        const burst = Math.sin(Math.min(1, (this.t - 0.02) / 0.22) * Math.PI);
        stampDryBrush(ink, 8, -12, 4 + burst * 6, 0.18, burst * 0.9, 1);
      }

      // 3. Flung ink droplets & wet diffusion
      for (const d of droplets) {
        if (d.age <= 0 || d.age >= d.life) continue;
        const k = 1 - d.age / d.life;
        stampInkDrop(
          ink,
          Math.max(-58, Math.min(58, d.x)),
          Math.max(-58, Math.min(58, d.y)),
          d.r * (0.65 + 0.35 * k),
          k * 0.95,
          d.isCinnabar ? 1 : 0,
        );
      }

      if (this.t > 0.08) {
        stepInkDiffusion(ink, 1 / 60, { threshold: 0.1, diffusionRate: 0.2, fringeStrength: 0.15 });
      }

      compositeInkFrame(ink, frame, {
        palette: opts.palette,
        defaultPalette: meta.defaultPalette,
        paperBackground: Boolean(opts.paperBackground),
        grainRoughness: opts.grainRoughness ?? 1.0,
      });
    },
  };
}
