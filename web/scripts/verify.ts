import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getConfig, projectRoot, webRoot } from '../config/site.ts';

const exec = promisify(execFile);

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
const historicalPath = path.join(webRoot, 'verification/stage-0-source-hashes.json');
const historicalBytes = await readFile(historicalPath);
const historical = JSON.parse(historicalBytes.toString());
const baseline = JSON.parse(await readFile(path.join(webRoot, 'verification/source-baseline-2026-11-09.json'), 'utf8')) as {
  historical: { sha256: string; recordedAt: string; fileCount: number };
  tracked: Record<string, string>;
  absent: Record<string, string>;
  generatedCopies: { path: string; source: string; sha256: string }[];
  changedSince20261031: { path: string; reason: string; sha256_20261031: string; sha256_20261109: string; sha256_20261112?: string }[];
};
assert.equal(createHash('sha256').update(historicalBytes).digest('hex'), baseline.historical.sha256, '2026-10-31 ledger was modified');
assert.equal(historical.recordedAt, baseline.historical.recordedAt);
assert.equal(Object.keys(historical.files).length, baseline.historical.fileCount);
const tracked = new Set((await exec('git', ['ls-files', '-z'], { cwd: projectRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })).stdout.split('\0').filter(Boolean));
const generated = new Map(baseline.generatedCopies.map(item => [item.path, item]));
const drifted = [];
for (const [source, expected] of Object.entries(historical.files)) {
  const copy = generated.get(source);
  if (copy) {
    assert.equal(tracked.has(source), false, `Generated copy is tracked: ${source}`);
    assert.equal(historical.files[copy.source], copy.sha256, `Generated copy is not pinned to its 2026-10-31 source hash: ${source}`);
    const sourceHash = createHash('sha256').update(await readFile(path.join(projectRoot, copy.source))).digest('hex');
    assert.equal(sourceHash, copy.sha256, `Tracked source of a generated copy changed: ${copy.source}`);
    assert.equal(baseline.tracked[copy.source], copy.sha256, `Baseline hash of a generated copy source changed: ${copy.source}`);
    try {
      const copyHash = createHash('sha256').update(await readFile(path.join(projectRoot, source))).digest('hex');
      assert.equal(copyHash, copy.sha256, `Generated copy differs from its tracked source: ${source}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    continue;
  }
  if (!tracked.has(source)) {
    assert.equal(baseline.absent[source], 'local-only', `Untracked historical path is not recorded: ${source}`);
    continue;
  }
  assert.equal(baseline.absent[source], undefined, `Tracked file is listed as absent: ${source}`);
  const hash = createHash('sha256').update(await readFile(path.join(projectRoot, source))).digest('hex');
  assert.equal(hash, baseline.tracked[source], `Tracked file differs from the 2026-11-09 baseline: ${source}`);
  if (hash !== expected) drifted.push(source);
}
for (const source of Object.keys(baseline.tracked)) assert.ok(Object.hasOwn(historical.files, source), `Baseline tracks a file outside the 2026-10-31 ledger: ${source}`);
for (const source of Object.keys(baseline.absent)) assert.equal(tracked.has(source), false, `Local-only path is tracked: ${source}`);
for (const item of baseline.generatedCopies) assert.ok(Object.hasOwn(historical.files, item.path), `Generated copy is outside the 2026-10-31 ledger: ${item.path}`);
const accounted = Object.keys(baseline.tracked).length + Object.keys(baseline.absent).length + baseline.generatedCopies.length;
assert.equal(accounted, Object.keys(historical.files).length, '2026-11-09 baseline does not cover the 2026-10-31 ledger');
assert.deepEqual(drifted, baseline.changedSince20261031.map(item => item.path), 'Changed-file record does not match the 2026-10-31 ledger');
for (const item of baseline.changedSince20261031) {
  assert.ok(item.reason.trim().length > 0, `Missing reason: ${item.path}`);
  assert.equal(historical.files[item.path], item.sha256_20261031, `2026-10-31 hash record changed: ${item.path}`);
  assert.equal(baseline.tracked[item.path], item.sha256_20261112 ?? item.sha256_20261109, `Current hash record does not match the tracked baseline: ${item.path}`);
}
console.log(`PASS: ${checked} local links/assets/anchors; ${Object.keys(baseline.tracked).length} tracked originals match 2026-11-09; ${baseline.generatedCopies.length} generated copies checked via tracked sources; ${Object.keys(baseline.absent).length} local-only paths not hashed; base=${info.base}; draft preview=${info.includeDrafts}`);
