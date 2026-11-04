import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getConfig } from '../config/site.ts';
import { loadArticle, parseArticle } from '../src/content/article.ts';
import { renderMarkdown, resolveLink, renderSource } from '../src/content/markdown.ts';
import { createApp } from '../src/server/app.ts';

test('base accepts only a rooted directory path and builds consistent URLs', () => {
  const config = getConfig({ SITE_BASE: '/Howitworks/' });
  assert.equal(config.href('articles/brotli/'), '/Howitworks/articles/brotli/');
  for (const base of ['https://example.com/', '//', '/../', '/a/../', '/%2e%2e/', '/Howitworks']) {
    assert.throws(() => getConfig({ SITE_BASE: base }));
  }
});

test('article frontmatter is validated rather than silently accepted', () => {
  assert.throws(() => parseArticle('# No metadata'));
  assert.throws(() => parseArticle('---\ntitle: Test\nstatus: public\n---\nBody'));
});

test('ordinary build does not expose the draft article or its source records', async () => {
  const article = await loadArticle();
  const app = await createApp(getConfig({}), '/assets/site.css', article);
  assert.equal((await app.request(`/articles/${article.id}/`)).status, 404);
  assert.equal((await app.request('/references/research/')).status, 404);
  assert.doesNotMatch(await (await app.request('/')).text(), new RegExp(article.data.title));
});

test('draft preview is complete HTML with base-prefixed assets and no article JS', async () => {
  const article = await loadArticle();
  const config = getConfig({ SITE_BASE: '/Howitworks/', INCLUDE_DRAFTS: '1' });
  const app = await createApp(config, config.href('assets/site.css'), article);
  const response = await app.request(`/articles/${article.id}/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href="\/Howitworks\/assets\/site.css"/);
  assert.match(html, /href="\/Howitworks\/references\/http-result\/"/);
  assert.match(html, /正常なデコーダーも入力を待つ/);
  assert.match(html, /実際に対応してみると/);
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<script\b/);
});

test('unknown local references and executable URLs fail explicitly', () => {
  const config = getConfig({});
  assert.throws(() => resolveLink('../notes/unregistered.md', config), /Unmapped/);
  assert.throws(() => resolveLink('javascript:alert(1)', config), /Unsupported/);
  assert.throws(() => resolveLink('//evil.example/', config), /Unsupported/);
  assert.match(resolveLink('../notes/brotli-cve-2026-111497.md#response-record-2026-10-29', config), /#response-record-2026-10-29$/);
});

test('raw HTML is text and investigation record anchors are retained', () => {
  const result = renderMarkdown('<script>alert(1)</script>', getConfig({}));
  assert.doesNotMatch(result.html, /<script>/);
  assert.match(result.html, /&lt;script&gt;/);
  const record = renderSource('<a id="response-record-2026-10-29"></a>\n# Heading');
  assert.match(record, /<span id="response-record-2026-10-29">/);
  assert.doesNotMatch(record, /<a /);
});
