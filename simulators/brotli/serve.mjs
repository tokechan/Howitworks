import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--port')) {
  console.error('Usage: node simulators/brotli/serve.mjs [--port 4177]');
  process.exit(1);
}
const port = args.length ? Number(args[1]) : 4177;
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('Port must be an integer between 0 and 65535.');
  process.exit(1);
}
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/model.mjs', ['model.mjs', 'text/javascript; charset=utf-8']],
]);
const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const file = files.get(new URL(req.url, 'http://localhost').pathname);
  if (!file) { res.writeHead(404).end('Not found'); return; }
  try {
    const body = await readFile(new URL(`./dist/${file[0]}`, import.meta.url));
    res.writeHead(200, {
      'Content-Type': file[1],
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'",
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500).end('Could not load simulator file');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Try --port 4178.`
    : `Server error: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Brotli simulator: http://127.0.0.1:${server.address().port}`);
  console.log('Loopback only. Press Ctrl+C to stop.');
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { server.close(); server.closeAllConnections(); });
}
