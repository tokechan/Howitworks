import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { brotliCompressSync, constants } from 'node:zlib';
import { readWithHttp, readWithFetch } from './client.mjs';

// 送信側の準備。自作の小さな正常データだけを圧縮する。
const sentence = 'Brotliを直接呼ばなくても、HTTPクライアントが本文を展開することがあります。\n';
const original = Buffer.from(sentence.repeat(40), 'utf8');
const compressed = brotliCompressSync(original, {
  params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
});

const requests = [];
const server = createServer((request, response) => {
  if (request.method !== 'GET' || !['/br', '/raw-file'].includes(request.url)) {
    response.writeHead(404, { Connection: 'close' });
    response.end();
    return;
  }

  const withEncoding = request.url === '/br';
  requests.push({
    path: request.url,
    httpVersion: request.httpVersion,
    acceptEncoding: request.headers['accept-encoding'],
    responseEncoding: withEncoding ? 'br' : '(none)',
    sentBodyBytes: compressed.length,
  });

  const responseHeaders = {
    'Content-Type': 'application/octet-stream',
    'Content-Length': compressed.length,
    'Cache-Control': 'no-store',
    Connection: 'close',
  };
  if (withEncoding) responseHeaders['Content-Encoding'] = 'br';
  response.writeHead(200, responseHeaders);
  // /raw-fileでも同じ圧縮済みバイト列を送る。ヘッダーだけが違う。
  response.end(compressed);
});

async function main() {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    // 127.0.0.1: 自分のMac内だけ。0: 空いているポートをOSに選んでもらう。
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    console.log(`Node.js ${process.version}; ${process.platform}/${process.arch}; Brotli ${process.versions.brotli}; Undici ${process.versions.undici}`);
    console.log(`Local server: ${baseUrl}`);
    console.log(`Original: ${original.length} bytes; compressed: ${compressed.length} bytes`);
    console.log('Every request explicitly sends Accept-Encoding: br.');

    const cases = [
      { label: 'A: node:http + br', result: await readWithHttp(`${baseUrl}/br`) },
      { label: 'B: fetch + br', result: await readWithFetch(`${baseUrl}/br`) },
      { label: 'C: fetch + no encoding', result: await readWithFetch(`${baseUrl}/raw-file`) },
    ];

    console.table(cases.map(({ label, result }) => ({
      case: label,
      encoding: result.contentEncoding,
      contentLength: result.contentLength,
      bodyBytes: result.body.length,
      sameAsOriginal: result.body.equals(original),
      sameAsCompressed: result.body.equals(compressed),
    })));
    console.log('Server-side observations:');
    console.table(requests);

    // バイト数だけでなく、全文のバイト列が一致することまで確認する。
    for (const { result } of cases) {
      assert.equal(result.status, 200);
      assert.equal(result.contentLength, compressed.length);
    }
    assert.equal(cases[0].result.contentEncoding, 'br');
    assert.equal(cases[1].result.contentEncoding, 'br');
    assert.equal(cases[2].result.contentEncoding, '(none)');
    assert(cases[0].result.body.equals(compressed), 'A must preserve compressed bytes');
    assert(cases[1].result.body.equals(original), 'B must return original bytes');
    assert(cases[2].result.body.equals(compressed), 'C must preserve compressed bytes');
    assert.equal(requests.length, 3);
    for (const request of requests) {
      assert.equal(request.httpVersion, '1.1');
      assert.equal(request.acceptEncoding, 'br');
    }

    console.log(`B: first line = ${cases[1].result.body.toString('utf8').split('\n')[0]}`);
    console.log('PASS: A and C preserve compressed bytes; B returns the original bytes.');
  } finally {
    // 結果を表示したら、この実験用サーバーを停止する。
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
    console.log('Local server stopped.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
