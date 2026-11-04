import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.SLIDEV_PREVIEW_PORT ?? 3031);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SLIDEV_PREVIEW_PORT');
await stat(resolve(root, 'index.html'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405, { Allow: 'GET, HEAD' }).end();
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(root + sep)) return res.writeHead(403).end();
    if (pathname.endsWith('/')) target = resolve(target, 'index.html');
    // Slidev's numeric/presenter routes are handled by the client router.
    if (!extname(target)) target = resolve(root, 'index.html');
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': `${types[extname(target)] ?? 'application/octet-stream'}${['.html', '.js', '.mjs', '.css', '.txt'].includes(extname(target)) ? '; charset=utf-8' : ''}`, 'Content-Length': data.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Brotli LT preview: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });
