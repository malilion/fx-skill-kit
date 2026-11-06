import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { validId } from '../src/core/run.js';
import { isMain, parseArgs } from './cli.mjs';

let catalogWrites = 0;
export async function scaffold(id, outDir = 'examples/fx', { loop = false, sim = false, catalogFile = 'src/catalog.json' } = {}) {
  if (!validId(id)) throw new Error('id must be lowercase kebab-case or category/name');
  const file = resolve(outDir, `${id}.js`);
  const category = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : null;
  let catalog;
  try { catalog = JSON.parse(await readFile(catalogFile, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    catalog = { schemaVersion: 1, effects: [] };
  }
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.effects)) throw new Error('Invalid catalog schema');
  if (catalog.effects.some(effect => effect.id === id)) throw new Error(`Catalog already contains ${id}`);
  const importPath = target => {
    const path = relative(dirname(file), resolve(target)).split(sep).join('/');
    return path.startsWith('.') ? path : `./${path}`;
  };
  const source = `import { fillCircle } from ${JSON.stringify(importPath('src/core/frame.js'))};
import { mulberry32 } from ${JSON.stringify(importPath('src/core/seed.js'))};

export const meta = { id: '${id}', category: ${JSON.stringify(category)}, duration: 1, loop: ${loop}, sim: ${sim}, w: 160, h: 160, ox: 80, oy: 80 };

/** @param {{ seed?: number }} opts */
export function create({ seed = 1 } = {}) {
  const radius = 15 + mulberry32(seed)() * 10;
  return {
    t: 0,
${sim ? `    // Fixed-step simulation: integrate state in step; draw only reads it.
    phase: 0,
    step(dt) { this.t += dt; this.phase += dt / meta.duration; },` : '    step(dt) { this.t += dt; },'}
    draw(frame) {
      const p = ${sim ? 'this.phase' : 'this.t / meta.duration'};
      const alpha = ${loop ? '150 + 80 * Math.sin(2 * Math.PI * p)' : '230 * Math.sin(Math.PI * Math.min(1, p))'};
      fillCircle(frame, frame.ox, frame.oy, radius, [34, 60, 68, alpha], 0.8);
    },
  };
}
`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, source, { flag: 'wx' });
  const tempCatalog = `${resolve(catalogFile)}.tmp-${process.pid}-${++catalogWrites}`;
  try {
    catalog.effects.push({ id, file: relative(process.cwd(), file).split(sep).join('/'), category, loop, sim });
    catalog.effects.sort((a, b) => a.id.localeCompare(b.id));
    await mkdir(dirname(resolve(catalogFile)), { recursive: true });
    await writeFile(tempCatalog, `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'wx' });
    await rename(tempCatalog, resolve(catalogFile));
  } catch (error) {
    await rm(file, { force: true });
    throw error;
  } finally {
    await rm(tempCatalog, { force: true });
  }
  return file;
}

export async function main(args = process.argv.slice(2), { log = console.log } = {}) {
  const { files, options } = parseArgs(args, ['out', 'catalog'], ['loop', 'sim']);
  if (options.help) { log('Usage: npm run new -- <category/name|id> [--loop] [--sim] [--out examples/fx] [--catalog src/catalog.json]'); return; }
  if (files.length !== 1) throw new Error('Provide one FX id (npm run new -- category/my-pulse)');
  log(`Created ${await scaffold(files[0], options.out, {
    loop: Boolean(options.loop), sim: Boolean(options.sim), catalogFile: options.catalog,
  })}`);
}

if (isMain(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
