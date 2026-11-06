import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const examples = ['examples/fx/pulse-dot.js', 'examples/fx/orbit-loop.js'];
export function isMain(url) {
  return Boolean(process.argv[1]) && url === pathToFileURL(resolve(process.argv[1])).href;
}

export function parseArgs(args, allowed) {
  const files = [];
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    if (!arg.startsWith('--')) { files.push(arg); continue; }
    const key = arg.slice(2);
    if (!allowed.includes(key)) throw new Error(`Unknown option: ${arg}`);
    if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${arg}`);
    options[key] = args[++i];
  }
  return { files, options };
}

export function numberOption(options, key, fallback) {
  const value = options[key] === undefined ? fallback : Number(options[key]);
  if (!Number.isFinite(value)) throw new Error(`--${key} must be a finite number`);
  return value;
}
