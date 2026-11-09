import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep, normalize } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
};

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
};

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD', ...securityHeaders });
      res.end('Method not allowed');
      return;
    }
    if (req.url.includes('%00') || req.url.includes('\0')) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders });
      res.end('Bad request');
      return;
    }
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/') path = '/gallery/';
    if (path.endsWith('/')) path += 'index.html';

    const segments = path.split('/').filter(Boolean);
    if (segments.some(seg => seg.startsWith('.'))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders }).end('Not found');
      return;
    }

    const file = resolve(root, `.${path}`);
    const rootPrefix = root.endsWith(sep) ? root : root + sep;
    if (!file.startsWith(rootPrefix) || !/^\/(gallery|src|examples|docs)\//.test(path) || !types[extname(file)]) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders }).end('Not found');
      return;
    }

    const [realFile, canonicalRoot] = await Promise.all([realpath(file), realpath(root)]);
    const canonicalPrefix = canonicalRoot.endsWith(sep) ? canonicalRoot : canonicalRoot + sep;
    if (!realFile.startsWith(canonicalPrefix)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders }).end('Not found');
      return;
    }

    const data = await readFile(realFile);
    res.writeHead(200, {
      'Content-Type': types[extname(file)],
      'Content-Length': Buffer.byteLength(data),
      'Cache-Control': 'no-store',
      ...securityHeaders,
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders }).end('Not found');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError('Invalid PORT');
server.listen(port, '127.0.0.1', () => console.log(`FX gallery: http://127.0.0.1:${server.address().port}/gallery/ (Ctrl+C to stop)`));
