import { get } from 'node:http';

// 受信側にはBrotliの圧縮・展開APIを置かない。
// 3ケースとも同じ条件で「brの応答を受け取れる」と伝える。
const headers = { 'Accept-Encoding': 'br' };

export function readWithHttp(url) {
  return new Promise((resolve, reject) => {
    const request = get(url, {
      headers,
      agent: false,
      signal: AbortSignal.timeout(5000),
    }, async (response) => {
      try {
        const chunks = [];
        for await (const chunk of response) chunks.push(chunk);
        resolve({
          status: response.statusCode,
          contentEncoding: response.headers['content-encoding'] ?? '(none)',
          contentLength: Number(response.headers['content-length']),
          body: Buffer.concat(chunks),
        });
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

export async function readWithFetch(url) {
  const response = await fetch(url, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  return {
    status: response.status,
    contentEncoding: response.headers.get('content-encoding') ?? '(none)',
    contentLength: Number(response.headers.get('content-length')),
    body: Buffer.from(await response.arrayBuffer()),
  };
}
