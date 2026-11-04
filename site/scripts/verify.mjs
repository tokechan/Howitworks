import { readdir, readFile, stat, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { outDir, articleId } from './config.mjs';

const info = JSON.parse(await readFile(path.join(outDir, 'build-info.json'), 'utf8'));
const release = process.argv.includes('--release');
if (release) {
  assert.equal(info.drafts, false, 'Release requires INCLUDE_DRAFTS=0. Rebuild without draft preview.');
  assert.equal(info.brotli, true, 'Brotli is not included. Review the article, set its frontmatter status to published, then rebuild.');
  assert.ok(info.origin?.startsWith('https://'), 'Release requires SITE_ORIGIN from the Pages settings.');
}
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.endsWith('.html') && !file.includes('/pagefind/')) files.push(file);
  }
}
await walk(outDir);
let links = 0;
const failures = [];
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const local = path.relative(outDir, file);
  const origin = new URL(info.base + local, 'http://site.test');
  for (const [, raw] of html.matchAll(/(?:href|src|action)="([^"{}]+)"/g)) {
    if (/^(?:data:|mailto:|javascript:)/.test(raw)) continue;
    const url = new URL(raw.replaceAll('&amp;', '&'), origin);
    if (url.origin !== origin.origin) continue;
    if (!url.pathname.startsWith(info.base)) { failures.push(`${local}: outside base: ${raw}`); continue; }
    let target = path.join(outDir, decodeURIComponent(url.pathname.slice(info.base.length)));
    try {
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      await access(target);
      if (url.hash && !url.hash.startsWith('#/') && target.endsWith('.html')) {
        const content = target === file ? html : await readFile(target, 'utf8');
        const fragment = decodeURIComponent(url.hash.slice(1));
        if (fragment && !content.includes(`id="${fragment}"`)) failures.push(`${local}: missing anchor: ${raw}`);
      }
      links++;
    } catch { failures.push(`${local}: missing file: ${raw}`); }
  }
}
assert.deepEqual(failures, [], failures.join('\n'));
await access(path.join(outDir, 'pagefind/pagefind.js'));
const articleFile = path.join(outDir, `articles/${articleId}/index.html`);
if (info.brotli ?? info.drafts) {
  const article = await readFile(articleFile, 'utf8');
  for (const text of ['4,280', 'Vercel', 'BROTLI_DECODER_NEEDS_MORE_INPUT', 'ブロートリ', 'data-pagefind-body', `${info.base}labs/brotli/`, `${info.base}talks/brotli/`]) assert.ok(article.includes(text), `Missing article content: ${text}`);
  assert.equal((article.match(/<h1\b/g) || []).length, 1, 'The article must have a single title.');
  await access(path.join(outDir, 'decks/brotli/index.html'));
  await access(path.join(outDir, 'demos/brotli/app.mjs'));
  await access(path.join(outDir, 'decks/brotli/evidence/patch-flow.jpg'));
}
console.log(`PASS: ${files.length} HTML files, ${links} local links/assets/anchors; base=${info.base}; draft preview=${info.drafts}${release ? '; release checks passed' : ''}.`);
