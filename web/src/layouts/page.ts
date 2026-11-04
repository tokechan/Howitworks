import { html, raw } from 'hono/html';
import type { Article } from '../content/article.ts';
import { renderMarkdown } from '../content/markdown.ts';
import type { SiteConfig } from '../../config/site.ts';

export function page(config: SiteConfig, css: string, title: string, description: string, content: string) {
  return html`<!doctype html><html lang="ja"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${description}"><meta name="robots" content="noindex, nofollow">
    <meta name="color-scheme" content="light"><title>${title} · Howitworks</title>
    <link rel="stylesheet" href="${css}">
  </head><body>
    <a class="skip-link" href="#main">本文へ移動</a>
    <header class="site-header"><a class="brand" href="${config.href()}">Howitworks<span>?</span></a>
      <nav aria-label="メインナビゲーション"><a href="${config.href()}">記事一覧</a><span class="preview-label">ローカルプレビュー</span></nav>
    </header>
    <main id="main" tabindex="-1">${raw(content)}</main>
    <footer class="site-footer"><a class="brand" href="${config.href()}">Howitworks<span>?</span></a><p>調べる。動かす。自分の言葉にする。</p><a href="#main">ページの上へ ↑</a></footer>
  </body></html>`;
}

export async function articlePage(config: SiteConfig, css: string, article: Article) {
  const { data } = article;
  const body = renderMarkdown(article.body, config);
  const toc = body.headings.filter(h => h.depth === 2);
  const content = await html`
    <div class="breadcrumb"><a href="${config.href()}">記事一覧</a><span aria-hidden="true">/</span><span>Brotli</span></div>
    <header class="article-header"><p class="eyebrow">RESEARCH NOTE <span>01</span></p>
      <h1>${data.title}</h1><p class="question">${data.question}</p>
      <div class="article-meta">${data.status === 'draft' ? html`<span class="draft-label">下書き</span>` : ''}<span>作成 <time>${data.createdAt}</time></span><span>更新 <time>${data.updatedAt}</time></span><span>情報確認 <time>${data.verifiedAt}</time></span></div>
      <div class="tags">${data.tags.map(tag => html`<span>${tag}</span>`)}</div>
    </header>
    <div class="article-layout"><article class="prose">${raw(body.html)}
      <aside class="verification-note"><strong>情報の確認範囲</strong><p>${data.verificationScope}</p></aside>
    </article><aside class="toc"><details open><summary>この記事の目次</summary><nav aria-label="記事の目次"><ol>${toc.map(h => html`<li><a href="#${h.id}">${raw(h.text)}</a></li>`)}</ol></nav></details></aside></div>`;
  return page(config, css, data.title, data.description, content.toString());
}

export async function homePage(config: SiteConfig, css: string, article: Article | null) {
  const content = await html`<section class="home"><p class="eyebrow">PERSONAL KNOWLEDGE NOTES</p><h1>しくみを、<br>自分の言葉に。</h1><p class="home-description">開発の中で出会った「なんで？」を、<br>調べて、動かして、出典とともに残すノート。</p>
    <div class="section-label"><h2>記事</h2><span>${article ? '01' : '00'}</span></div>
    ${article ? html`<a class="article-card" href="${config.href(`articles/${article.id}/`)}"><span class="eyebrow">BROTLI / NODE.JS ${article.data.status === 'draft' ? '· 下書き' : ''}</span><h3>${article.data.title}<span aria-hidden="true">↗</span></h3><p>${article.data.description}</p><span class="read-link">記事を読む →</span></a>` : html`<p class="empty">現在、公開状態の記事はありません。</p>`}
  </section>`;
  return page(config, css, 'しくみを、自分の言葉に。', '開発の仕組みを調べ、実験し、出典とともに残す個人のナレッジノート。', content.toString());
}
