import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { isMain, parseArgs } from './cli.mjs';

export async function scaffold(id, outDir = 'examples/fx') {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error('id must be lowercase kebab-case');
  const file = resolve(outDir, `${id}.js`);
  const importPath = target => {
    const path = relative(dirname(file), resolve(target)).split(sep).join('/');
    return path.startsWith('.') ? path : `./${path}`;
  };
  const source = `import { fillCircle } from ${JSON.stringify(importPath('src/core/frame.js'))};
import { mulberry32 } from ${JSON.stringify(importPath('src/core/seed.js'))};

export const meta = { id: '${id}', duration: 1, loop: false, w: 160, h: 160, ox: 80, oy: 80 };

export function create({ seed = 1 } = {}) {
  const radius = 15 + mulberry32(seed)() * 10;
  return {
    t: 0,
    step(dt) { this.t += dt; },
    draw(frame) {
      const p = Math.min(1, this.t / meta.duration);
      fillCircle(frame, frame.ox, frame.oy, radius, [34, 60, 68, 230 * Math.sin(Math.PI * p)], 0.8);
    },
  };
}
`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, source, { flag: 'wx' });
  return file;
}

export async function main(args = process.argv.slice(2)) {
  const { files, options } = parseArgs(args, ['out']);
  if (options.help) { console.log('Usage: npm run new -- <id> [--out examples/fx]'); return; }
  if (files.length !== 1) throw new Error('Provide one FX id (npm run new -- my-pulse)');
  console.log(`Created ${await scaffold(files[0], options.out)}`);
}

if (isMain(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
