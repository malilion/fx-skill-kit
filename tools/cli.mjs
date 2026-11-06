import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

export const examples = ['examples/fx/pulse-dot.js', 'examples/fx/orbit-loop.js'];
export function isMain(url) {
  return Boolean(process.argv[1]) && url === pathToFileURL(resolve(process.argv[1])).href;
}

export function parseArgs(args, allowed, flags = []) {
  const files = [];
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    if (!arg.startsWith('--')) { files.push(arg); continue; }
    const key = arg.slice(2);
    if (flags.includes(key)) { options[key] = true; continue; }
    if (!allowed.includes(key)) throw new Error(`Unknown option: ${arg}`);
    if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${arg}`);
    options[key] = args[++i];
  }
  return { files, options };
}

export async function resolveFXFile(input) {
  if (input.endsWith('.js') || input.endsWith('.mjs')) return input;
  try {
    const catalog = JSON.parse(await readFile('src/catalog.json', 'utf8'));
    const entry = catalog.effects.find(effect => effect.id === input);
    if (entry) return entry.file;
    throw new Error(`Unknown effect ID: "${input}". Available IDs: ${catalog.effects.map(effect => effect.id).join(', ')}. Use a catalog ID or a .js/.mjs file path.`);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Unknown effect ID: "${input}". No src/catalog.json found; run from the repository root or pass a .js/.mjs file path.`);
    throw error;
  }
}

export function numberOption(options, key, fallback) {
  const value = options[key] === undefined ? fallback : Number(options[key]);
  if (!Number.isFinite(value)) throw new Error(`--${key} must be a finite number`);
  return value;
}
