export { createFrame, clear, setPixel, fillCircle } from './core/frame.js';
export { mulberry32, hash2d, valueNoise2d, paperGrainMap } from './core/seed.js';
export { palettes, paletteColors, mineralRamps, mineralRampColors } from './core/palette.js';
export { viewPoint, clampTilt } from './core/view.js';
export { packAlphaMask, formatCHeader } from './core/mask.js';
export {
  createInkFrame,
  clearInkFrame,
  stampDryBrush,
  stampInkDrop,
  stampInkStroke,
  stepInkDiffusion,
  compositeInkFrame,
} from './core/ink.js';
export { BAYER_4X4, ditherSample, ditherBuffer } from './core/dither.js';
export {
  OLED_PROFILES,
  createOledScreen,
  packVerticalPages,
  encodeRlePacketStream,
  encodeXorRle,
  decodeXorRleStep,
  formatMcuHeader,
  formatBitmapHeader,
  rgbaToRgb565,
  packRgb565Frame,
  encodeRgb565PacketStream,
  encodeRgb565XorRle,
  decodeRgb565XorRleStep,
  formatRgb565Header,
} from './core/oled.js';

import * as pulseDot from '../examples/fx/pulse-dot.js';
import * as orbitLoop from '../examples/fx/orbit-loop.js';
import * as swordQiSlash from './fx/sword/sword-qi-slash.js';
import * as crossCleave from './fx/sword/cross-cleave.js';
import * as myriadSwords from './fx/sword/myriad-swords.js';
import * as baguaSeal from './fx/talisman/bagua-seal.js';
import * as cinnabarBurn from './fx/talisman/cinnabar-burn.js';
import * as inkChains from './fx/talisman/ink-chains.js';
import * as bambooWind from './fx/zen/bamboo-wind.js';
import * as plumBlossom from './fx/zen/plum-blossom.js';
import * as fallingSakura from './fx/zen/falling-sakura.js';
import * as heavyImpact from './fx/ink-burst/heavy-impact.js';
import * as qiSurge from './fx/ink-burst/qi-surge.js';
import * as splashGuard from './fx/ink-burst/splash-guard.js';
import * as brushSweep from './fx/transitions/brush-sweep.js';
import * as inkDropWash from './fx/transitions/ink-drop-wash.js';
import * as vermilionSeal from './fx/ui/vermilion-seal.js';
import * as realmBreakthrough from './fx/ui/realm-breakthrough.js';
import * as happySquint from './fx/eyes/happy-squint.js';
import * as curiousBlink from './fx/eyes/curious-blink.js';
import * as cyberCharge from './fx/eyes/cyber-charge.js';
import * as dizzySpiral from './fx/eyes/dizzy-spiral.js';
import * as rainStorm from './fx/weather/rain-storm.js';
import * as sunnyOrbit from './fx/weather/sunny-orbit.js';
import * as snowDrift from './fx/weather/snow-drift.js';
import * as wifiPulse from './fx/system/wifi-pulse.js';
import * as batteryCharge from './fx/system/battery-charge.js';
import * as cpuWave from './fx/system/cpu-wave.js';
import * as hotCoffee from './fx/pomodoro/hot-coffee.js';
import * as hourglassFlip from './fx/pomodoro/hourglass-flip.js';
import * as crtOff from './fx/transitions/crt-off.js';
import * as venetianBlinds from './fx/transitions/venetian-blinds.js';

export const effects = {
  'pulse-dot': pulseDot,
  'orbit-loop': orbitLoop,
  'sword/sword-qi-slash': swordQiSlash,
  'sword/cross-cleave': crossCleave,
  'sword/myriad-swords': myriadSwords,
  'talisman/bagua-seal': baguaSeal,
  'talisman/cinnabar-burn': cinnabarBurn,
  'talisman/ink-chains': inkChains,
  'zen/bamboo-wind': bambooWind,
  'zen/plum-blossom': plumBlossom,
  'zen/falling-sakura': fallingSakura,
  'ink-burst/heavy-impact': heavyImpact,
  'ink-burst/qi-surge': qiSurge,
  'ink-burst/splash-guard': splashGuard,
  'transitions/brush-sweep': brushSweep,
  'transitions/ink-drop-wash': inkDropWash,
  'ui/vermilion-seal': vermilionSeal,
  'ui/realm-breakthrough': realmBreakthrough,
  'eyes/happy-squint': happySquint,
  'eyes/curious-blink': curiousBlink,
  'eyes/cyber-charge': cyberCharge,
  'eyes/dizzy-spiral': dizzySpiral,
  'weather/rain-storm': rainStorm,
  'weather/sunny-orbit': sunnyOrbit,
  'weather/snow-drift': snowDrift,
  'system/wifi-pulse': wifiPulse,
  'system/battery-charge': batteryCharge,
  'system/cpu-wave': cpuWave,
  'pomodoro/hot-coffee': hotCoffee,
  'pomodoro/hourglass-flip': hourglassFlip,
  'transitions/crt-off': crtOff,
  'transitions/venetian-blinds': venetianBlinds,
};

export function openEffect(id) {
  const fx = effects[id];
  if (!fx) throw new Error(`Unknown effect: ${id}. Available: ${Object.keys(effects).join(', ')}`);
  return fx;
}
