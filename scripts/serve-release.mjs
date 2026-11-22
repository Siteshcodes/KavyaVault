import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Packaged beside app/. Serves only this release on the local computer.
const root = fileURLToPath(new URL('./app/', import.meta.url));
const port = Number(process.env.KAVYAVAULT_PORT || 8080);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid KAVYAVAULT_PORT');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (file !== path.resolve(root) && !file.startsWith(path.resolve(root) + path.sep)) { response.writeHead(403); response.end(); return; }
    let info;
    try { info = await stat(file); } catch { /* SPA route fallback below */ }
    if (info?.isDirectory()) file = path.join(file, 'index.html');
    else if (!info && !path.extname(pathname)) file = path.join(root, 'index.html');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`KavyaVault: http://127.0.0.1:${port} — keep this window open for first load. Ctrl+C stops the server.`));
