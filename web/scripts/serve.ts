import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getConfig } from '../config/site.ts';

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

export async function startServer(outDir: string, port = 4331): Promise<Server> {
  const { base } = JSON.parse(await readFile(path.join(outDir, 'build-info.json'), 'utf8'));
  const server = createServer(async (req, res) => {
    const send404 = async () => {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(path.join(outDir, '404.html')));
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
    }
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (base !== '/' && url.pathname === base.slice(0, -1)) {
        res.writeHead(308, { Location: base + url.search }).end(); return;
      }
      if (!url.pathname.startsWith(base)) { await send404(); return; }
      const relative = decodeURIComponent(url.pathname.slice(base.length));
      let file = path.resolve(outDir, relative);
      if (file !== outDir && !file.startsWith(outDir + path.sep)) {
        res.writeHead(403).end('Forbidden'); return;
      }
      const info = await stat(file);
      if (info.isDirectory()) {
        if (!url.pathname.endsWith('/')) {
          res.writeHead(308, { Location: url.pathname + '/' + url.search }).end(); return;
        }
        file = path.join(file, 'index.html');
      }
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (error instanceof URIError) { res.writeHead(400).end('Bad request'); return; }
      await send404();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  console.log(`Local: http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}${base}`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startServer(getConfig().outDir, Number(process.env.PORT || 4331));
  process.once('SIGINT', () => server.close());
  process.once('SIGTERM', () => server.close());
}
