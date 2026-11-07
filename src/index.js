export { createFrame, clear, setPixel, fillCircle } from './core/frame.js';
export { mulberry32 } from './core/seed.js';
export { palettes, paletteColors } from './core/palette.js';
export { viewPoint, clampTilt } from './core/view.js';
export { packAlphaMask, formatCHeader } from './core/mask.js';

import * as pulseDot from '../examples/fx/pulse-dot.js';
import * as orbitLoop from '../examples/fx/orbit-loop.js';

export const effects = {
  'pulse-dot': pulseDot,
  'orbit-loop': orbitLoop,
};

export function openEffect(id) {
  const fx = effects[id];
  if (!fx) throw new Error(`Unknown effect: ${id}. Available: ${Object.keys(effects).join(', ')}`);
  return fx;
}
