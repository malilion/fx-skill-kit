import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import { isMain } from './cli.mjs';
import { renderFX } from './render.mjs';
import { checkFX } from './check.mjs';
import { exportAsset } from './export.mjs';
import { validId } from '../src/core/run.js';

const string = { type: 'string' };
const palette = { anyOf: [string, { type: 'array', minItems: 1, items: string }] };
const schema = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
export const toolSchemas = [
  { name: 'fx_search_catalog', description: 'Find local effects by ranked words in IDs, descriptions, tags, or category.',
    inputSchema: schema({ query: string, category: string }) },
  { name: 'fx_render_contact_sheet', description: 'Render and return an annotated PNG contact sheet as an image block.',
    inputSchema: schema({ effect_id: string, palette }, ['effect_id']) },
  { name: 'fx_run_diagnostics', description: 'Run CHK-01..06 with seed 42; return the complete structured report.',
    inputSchema: schema({ effect_id: string }, ['effect_id']) },
  { name: 'fx_export_asset', description: 'Bake a transparent sprite atlas, preview GIF, contact PNG, or page-packed 1-bit C header.',
    inputSchema: schema({ effect_id: string, target_format: { enum: ['sheet', 'gif', 'png', 'c-header'] }, palette }, ['effect_id', 'target_format']) },
];
const textResult = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const invalid = message => Object.assign(new Error(message), { code: -32602 });
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);

function validate(name, args) {
  const tool = toolSchemas.find(tool => tool.name === name);
  if (!tool) throw invalid(`Unknown tool: ${name}`);
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw invalid('arguments must be an object');
  for (const key of tool.inputSchema.required) if (!Object.hasOwn(args, key)) throw invalid(`Missing ${key}`);
  for (const [key, value] of Object.entries(args)) {
    if (forbiddenKeys.has(key) || !Object.hasOwn(tool.inputSchema.properties, key)) throw invalid(`Unknown argument: ${key}`);
    const field = tool.inputSchema.properties[key];
    if (field.enum ? !field.enum.includes(value) : key === 'palette'
      ? !(typeof value === 'string' || Array.isArray(value) && value.length > 0 && value.every(c => typeof c === 'string'))
      : typeof value !== 'string') throw invalid(`Invalid ${key}`);
    if (key === 'effect_id' && (!validId(value) || !value.trim())) throw invalid('effect_id must be a valid FX identifier');
  }
}

export async function callTool(name, args = {}, { catalogFile = 'src/catalog.json', outDir } = {}) {
  validate(name, args);
  try {
    if (name === 'fx_search_catalog') {
      const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
      const terms = (args.query ?? '').toLowerCase().split(/[\s/\-]+/).filter(Boolean);
      const matches = catalog.effects.filter(e => !args.category || (e.category ?? e.id.split('/').slice(0, -1).join('/')) === args.category)
        .map(e => ({ ...e, score: terms.reduce((sum, term) => sum + Number(JSON.stringify(e).toLowerCase().includes(term)), 0) }))
        .filter(e => !terms.length || e.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      return textResult({ effects: matches });
    }
    // Only known catalog IDs are exposed over MCP; CLI tools also accept local paths.
    const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
    const entry = catalog.effects.find(e => e.id === args.effect_id);
    if (!entry) throw new Error(`Unknown effect_id: ${args.effect_id}`);
    const file = entry.file;
    if (name === 'fx_run_diagnostics') return textResult(await checkFX(file));
    if (name === 'fx_export_asset') return textResult(await exportAsset(file, args.target_format, { seed: 42, palette: args.palette, outDir }));
    const result = await renderFX(file, { seed: 42, palette: args.palette, outDir });
    return { content: [{ type: 'image', mimeType: 'image/png', data: (await readFile(result.png)).toString('base64') },
      { type: 'text', text: JSON.stringify({ png: result.png, json: result.json, hash: result.stats.hash }) }] };
  } catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
}

export function createHandler(options = {}) {
  let initialized = false, ready = false;
  return async message => {
    if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' ||
        ('id' in message && !(typeof message.id === 'string' || typeof message.id === 'number' && Number.isFinite(message.id))) ||
        ('params' in message && message.params !== undefined && (typeof message.params !== 'object' || message.params === null || Array.isArray(message.params)))) {
      return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
    }
    const { id, method, params = {} } = message;
    if (id === undefined) {
      if (method === 'notifications/initialized' && initialized) ready = true;
      return; // Notifications never receive a response.
    }
    try {
      let result;
      if (method === 'ping') result = {};
      else if (method === 'initialize') {
        if (initialized || typeof params.protocolVersion !== 'string') throw invalid('Invalid initialization');
        initialized = true;
        const supported = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
        result = { protocolVersion: supported.includes(params.protocolVersion) ? params.protocolVersion : supported[0],
          capabilities: { tools: {} }, serverInfo: { name: 'fx-skill-kit', version: '0.1.0' } };
      } else {
        if (!ready) throw Object.assign(new Error('Initialize and send notifications/initialized first'), { code: -32000 });
        if (method === 'tools/list') result = { tools: toolSchemas };
        else if (method === 'tools/call') result = await callTool(params.name, params.arguments ?? {}, options);
        else throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
      }
      return { jsonrpc: '2.0', id, result };
    } catch (error) { return { jsonrpc: '2.0', id, error: { code: error.code ?? -32603, message: error.message } }; }
  };
}

export async function serve({ input = process.stdin, output = process.stdout, ...options } = {}) {
  const handle = createHandler(options);
  // Sequential dispatch also keeps global clock guards and output files isolated.
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    let response;
    try { response = await handle(JSON.parse(line)); }
    catch { response = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }; }
    if (response) output.write(`${JSON.stringify(response)}\n`);
  }
}
if (isMain(import.meta.url)) {
  // Protect the protocol stream from console logging in local FX/config modules.
  console.log = console.error;
  if (process.argv.includes('--schemas')) process.stdout.write(`${JSON.stringify(toolSchemas, null, 2)}\n`);
  else serve().catch(error => { console.error(error.message); process.exitCode = 1; });
}
