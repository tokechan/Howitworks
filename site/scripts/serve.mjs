import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { outDir } from './config.mjs';
const info = JSON.parse(await readFile(path.join(outDir, 'build-info.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith(info.base)) { res.writeHead(404).end('Not found'); return; }
    const decoded = decodeURIComponent(url.pathname.slice(info.base.length));
    let file = path.resolve(outDir, decoded);
    if (!file.startsWith(outDir + path.sep) && file !== outDir) { res.writeHead(403).end(); return; }
    const st = await stat(file);
    if (st.isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
      file = path.join(file, 'index.html');
    }
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await readFile(path.join(outDir, '404.html')).catch(() => 'Not found'));
  }
});
server.listen(Number(process.env.PORT || 4321), '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${process.env.PORT || 4321}${info.base}`));
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
