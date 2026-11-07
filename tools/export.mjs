import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadFX, sampleFX, withoutMathRandom } from '../src/core/run.js';
import { formatCHeader } from '../src/core/mask.js';
import { renderFX } from './render.mjs';

export async function exportAsset(file, targetFormat, { outDir, seed = 42, palette } = {}) {
  if (!['sheet', 'gif', 'png', 'c-header'].includes(targetFormat)) throw new Error('target_format must be sheet, gif, png, or c-header');
  if (targetFormat !== 'c-header') {
    const result = await renderFX(file, { outDir, seed, palette, sheet: targetFormat === 'sheet', gif: targetFormat === 'gif' });
    return { format: targetFormat, files: targetFormat === 'sheet' ? [result.sprite.png, result.sprite.json] : [targetFormat === 'gif' ? result.gif : result.png] };
  }
  const run = await withoutMathRandom(async () => sampleFX(await loadFX(file), { seed, effectOptions: { palette } }));
  const { w, h, id, loop } = run.meta;
  const frames = loop ? run.frames.slice(0, -1) : run.frames;
  const header = formatCHeader({ id, w, h, frames, dt: run.dt, seed });
  const directory = resolve(outDir ?? join('records', id));
  await mkdir(directory, { recursive: true });
  const filePath = join(directory, 'asset.h');
  await writeFile(filePath, header);
  const stride = w * Math.ceil(h / 8);
  return { format: targetFormat, files: [filePath], bytes: stride * frames.length, frames: frames.length, width: w, height: h };
}
