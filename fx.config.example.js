import { inkEntropy, oledShimmer, oledRLEBudget } from './src/checks/domain.js';

// Copy to fx.config.js. Select the checks for your project's domain.
export const domainChecks = [inkEntropy()];
// OLED's RGBA adapter uses alpha >=128 for lit pixels (transparent = off).
// export const domainChecks = [oledShimmer({ maxRate: 0.1 }), oledRLEBudget({ maxBytes: 4096 })];
