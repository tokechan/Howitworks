import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const siteRoot = fileURLToPath(new URL('../', import.meta.url));
export const projectRoot = path.resolve(siteRoot, '..');
const requestedBase = process.env.SITE_BASE || '/';
if (!/^\/(?:[\w-]+\/)*$/.test(requestedBase)) throw new Error('SITE_BASE must be / or /path/ with a trailing slash.');
export const base = requestedBase;
const requestedOrigin = process.env.SITE_ORIGIN;
let parsedOrigin;
if (requestedOrigin) {
  parsedOrigin = new URL(requestedOrigin);
  if (parsedOrigin.protocol !== 'https:' || parsedOrigin.username || parsedOrigin.password || parsedOrigin.pathname !== '/' || parsedOrigin.search || parsedOrigin.hash) {
    throw new Error('SITE_ORIGIN must be an HTTPS origin without a path, credentials, query or fragment.');
  }
}
export const siteOrigin = parsedOrigin?.origin;
export const href = (url = '') => base + url.replace(/^\//, '');
export const outDir = path.join(siteRoot, process.env.SITE_BASE ? '.generated/base-site' : 'dist');
export const includeDrafts = process.env.INCLUDE_DRAFTS === '1';
export const articleId = 'brotli-cve-2026-111497';

// Only these evidence documents are copied into the site's content collection.
export const documents = [
  { id: 'brotli-http', file: 'notes/brotli-http-auto-decode-2026-10-27.md', label: 'HTTP自動展開の検証', kind: '検証記録' },
  { id: 'brotli-linkage', file: 'notes/brotli-node-linkage-2026-10-27.md', label: 'Node.jsのリンク方式', kind: '検証記録' },
  { id: 'brotli-research', file: 'notes/brotli-cve-2026-111497.md', label: '調査ノート・出典の対応', kind: '調査ノート' },
  { id: 'brotli-simulator', file: 'simulators/brotli/README.md', label: 'シミュレーターの操作説明', kind: '操作ガイド' },
  { id: 'brotli-simulator-checks', file: 'simulators/brotli/verification.md', label: 'シミュレーターの検証記録', kind: '検証記録' },
  { id: 'brotli-talk', file: 'talks/brotli/README.md', label: 'LT資料の使い方', kind: '操作ガイド' },
];

export const downloads = [
  'experiments/brotli-http/run.mjs',
  'experiments/brotli-http/client.mjs',
  'experiments/brotli-http/result-2026-10-27.txt',
  'simulators/brotli/dist/model.mjs',
  'simulators/brotli/dist/app.mjs',
  'simulators/brotli/design-notes.md',
  'talks/brotli/slides.md',
  'talks/brotli/rehearsal.md',
  'talks/brotli/verification.md',
];

export function resolveContentLink(url, source) {
  if (url === 'http://127.0.0.1:4177/' || url === 'http://localhost:4177/') return href('labs/brotli/');
  if (/^(?:https?:|mailto:|#|\/)/.test(url)) return url;
  const [filename, fragment] = url.split('#');
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(source), filename));
  let result;
  if (target === `articles/${articleId}.md`) result = href(`articles/${articleId}/`);
  else if (documents.some(d => d.file === target)) result = href(`evidence/${documents.find(d => d.file === target).id}/`);
  else if (target === 'simulators/brotli/dist/index.html') result = href('labs/brotli/');
  else if (target === 'assets/brotli-pipeline/index.html') result = href('demos/pipeline/index.html');
  else if (target === 'assets/brotli-pipeline/README.md') result = href('downloads/assets/brotli-pipeline/README.md.txt');
  else if (target.startsWith('simulators/brotli/screenshots/')) result = href(`media/${path.posix.basename(target)}`);
  else if (target.startsWith('talks/brotli/screenshots/')) result = href(`media/talk-${path.posix.basename(target)}`);
  else if (downloads.includes(target)) result = href(`downloads/${target}${target.endsWith('.txt') ? '' : '.txt'}`);
  else throw new Error(`Unmapped local content link: ${source} → ${url}`);
  return result + (fragment ? `#${fragment}` : '');
}
