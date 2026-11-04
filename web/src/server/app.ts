import { Hono } from 'hono';
import { html, raw } from 'hono/html';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot, type SiteConfig } from '../../config/site.ts';
import { references } from '../../config/resources.ts';
import { isVisible, type Article } from '../content/article.ts';
import { renderSource } from '../content/markdown.ts';
import { articlePage, homePage, page } from '../layouts/page.ts';

export async function createApp(config: SiteConfig, css: string, article: Article) {
  const app = new Hono();
  const visible = isVisible(article, config.includeDrafts);
  app.get('/', async c => c.html(await homePage(config, css, visible ? article : null)));
  if (visible) {
    app.get(`/articles/${article.id}/`, async c => c.html(await articlePage(config, css, article)));
    for (const ref of references) {
      const source = await readFile(path.join(projectRoot, ref.source), 'utf8');
      app.get(`/references/${ref.id}/`, async c => {
        const body = await html`<section class="source-page"><a class="back-link" href="${config.href(`articles/${article.id}/`)}">← Brotliの記事へ戻る</a><p class="eyebrow">SOURCE RECORD</p><h1>${ref.title}</h1><p class="source-description">保存された原文を表示しています。<code>${ref.source}</code></p><pre class="source-text">${raw(renderSource(source))}</pre></section>`;
        return c.html(await page(config, css, ref.title, ref.title, body.toString()));
      });
    }
  }
  const notFound = async () => page(config, css, 'ページが見つかりません', 'ページが見つかりません', `<section class="home"><p class="eyebrow">404</p><h1>ページが見つかりません。</h1><a href="${config.href()}">記事一覧に戻る →</a></section>`);
  app.get('/404.html', async c => c.html(await notFound()));
  app.notFound(async c => c.html(await notFound(), 404));
  return app;
}
