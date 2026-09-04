// Zero-dependency static server for local use and Playwright.
//   node tests/serve.js            → http://127.0.0.1:5500
//   PORT=8080 node tests/serve.js
// Serves the repo root. GET/HEAD only. Sends the Content-Security-Policy from the
// <meta> on index.html as a response header too, so local runs enforce the same
// policy every page carries (there is no server-side header layer in production).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 5500;
const LOG = process.env.RT_SERVE_LOG === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.stl': 'application/octet-stream',
  '.map': 'application/json; charset=utf-8'
};

export function readCsp() {
  try {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
    if (m) return m[1];
  } catch (e) { /* fall through */ }
  return "default-src 'self'";
}
const CSP = readCsp();

const DENIED_SEGMENTS = new Set(['.git', 'node_modules', '.claude', 'test-results', 'playwright-report']);

function send(res, status, headers, body) {
  res.writeHead(status, Object.assign({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store'
  }, headers));
  res.end(body);
}

function serve404(res, head) {
  let body = '<!doctype html><title>404</title><h1>404 Not Found</h1>';
  try { body = fs.readFileSync(path.join(ROOT, '404.html')); } catch (e) { /* default body */ }
  send(res, 404, { 'Content-Type': 'text/html; charset=utf-8' }, head ? undefined : body);
}

const server = http.createServer((req, res) => {
  const head = req.method === 'HEAD';
  if (req.method !== 'GET' && !head) {
    send(res, 405, { 'Content-Type': 'text/plain', Allow: 'GET, HEAD' }, head ? undefined : 'Method Not Allowed');
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `http://${HOST}:${PORT}`).pathname); }
  catch (e) { send(res, 400, { 'Content-Type': 'text/plain' }, 'Bad Request'); return; }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.some(s => DENIED_SEGMENTS.has(s) || (s.startsWith('.') && s !== '.'))) { serve404(res, head); return; }

  let filePath = path.resolve(ROOT, '.' + path.normalize('/' + segments.join('/')));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) { serve404(res, head); return; }

  let stat;
  try { stat = fs.statSync(filePath); } catch (e) { serve404(res, head); return; }
  if (stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    try { stat = fs.statSync(filePath); } catch (e) { serve404(res, head); return; }
  }

  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  if (LOG) console.log(req.method, pathname, '→', path.relative(ROOT, filePath));
  const headers = { 'Content-Type': type, 'Content-Length': stat.size };
  if (head) { send(res, 200, headers); return; }
  res.writeHead(200, Object.assign({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store'
  }, headers));
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`R-Tracker static server: http://${HOST}:${PORT}  (root: ${ROOT})`);
});
