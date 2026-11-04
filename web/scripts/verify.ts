import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getConfig, projectRoot, webRoot } from '../config/site.ts';

const { outDir } = getConfig();
const info = JSON.parse(await readFile(path.join(outDir, 'build-info.json'), 'utf8'));
const files: string[] = [];
async function walk(dir: string) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await walk(file); else files.push(file);
  }
}
await walk(outDir);
let checked = 0;
for (const file of files.filter(f => f.endsWith('.html'))) {
  const html = await readFile(file, 'utf8');
  const route = info.base + path.relative(outDir, file).replaceAll(path.sep, '/');
  for (const match of html.matchAll(/\b(?:href|src)="([^"\s]+)"/g)) {
    const value = match[1].replaceAll('&amp;', '&');
    const url = new URL(value, `http://preview.test/${route.replace(/^\//, '')}`);
    if (url.origin !== 'http://preview.test') continue;
    assert.ok(url.pathname.startsWith(info.base), `Wrong base: ${file} -> ${value}`);
    let target = path.join(outDir, decodeURIComponent(url.pathname.slice(info.base.length)));
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const bytes = await readFile(target);
    if (url.hash && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      assert.ok(bytes.toString().includes(`id="${id}"`), `Missing anchor: ${value}`);
    }
    checked++;
  }
}
assert.ok(files.some(f => f.endsWith(info.css.slice(info.base.length))), 'CSS from manifest exists');
if (!info.article) {
  for (const name of ['articles', 'references', 'media', 'demos']) {
    assert.ok(!files.some(f => path.relative(outDir, f).startsWith(`${name}/`)), `Draft files leaked: ${name}`);
  }
} else {
  const html = await readFile(path.join(outDir, 'articles', info.article, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script\b/);
  assert.match(html, /CVE-2026-111497/);
  assert.match(html, /正常なデコーダーも入力を待つ/);
  assert.match(html, /Vercel/);
}
const baseline = JSON.parse(await readFile(path.join(webRoot, 'verification/stage-0-source-hashes.json'), 'utf8'));
for (const [source, expected] of Object.entries(baseline.files)) {
  const hash = createHash('sha256').update(await readFile(path.join(projectRoot, source))).digest('hex');
  assert.equal(hash, expected, `Original file changed: ${source}`);
}
console.log(`PASS: ${checked} local links/assets/anchors; ${Object.keys(baseline.files).length} original files unchanged; base=${info.base}; draft preview=${info.includeDrafts}`);
