import path from 'node:path';
import { Marked, Renderer } from 'marked';
import { articleId, type SiteConfig } from '../../config/site.ts';
import { references, articleImage } from '../../config/resources.ts';

export const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function slug(text: string) {
  return text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
}

export function resolveLink(url: string, config: SiteConfig): string {
  if (/^(?:https?:|mailto:)/i.test(url) || url.startsWith('#')) return url;
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//')) throw new Error(`Unsupported link: ${url}`);
  const [filename, fragment] = url.split('#');
  const source = path.posix.normalize(path.posix.join('articles', filename));
  const ref = references.find(item => item.source === source);
  if (ref) return config.href(`references/${ref.id}/`) + (fragment ? `#${fragment}` : '');
  if (source === articleImage) return config.href('media/patch-flow.jpg');
  if (source === 'simulators/brotli/dist/index.html') return config.href('demos/brotli/');
  if (source === `articles/${articleId}.md`) return config.href(`articles/${articleId}/`);
  throw new Error(`Unmapped article link: ${url}`);
}

export function renderMarkdown(body: string, config: SiteConfig) {
  const headings: { id: string; text: string; depth: number }[] = [];
  const used = new Map<string, number>();
  const renderer = new Renderer();
  renderer.heading = function ({ tokens, depth }) {
    if (depth === 1) return '';
    const text = this.parser.parseInline(tokens);
    const base = slug(text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const id = count ? `${base}-${count}` : base;
    headings.push({ id, text: text.replace(/<[^>]*>/g, ''), depth });
    return `<h${depth} id="${escape(id)}">${text}</h${depth}>\n`;
  };
  renderer.link = function ({ href, title, tokens }) {
    const mapped = resolveLink(href, config);
    return `<a href="${escape(mapped)}"${title ? ` title="${escape(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`;
  };
  renderer.image = ({ href, title, text }) => `<figure><img src="${escape(resolveLink(href, config))}" alt="${escape(text)}" loading="lazy"${title ? ` title="${escape(title)}"` : ''}></figure>`;
  renderer.code = ({ text, lang }) => {
    const label = lang === 'mermaid' ? '処理経路 · Mermaid記法' : lang || 'text';
    return `<div class="code-block"><span class="code-label">${escape(label)}</span><pre tabindex="0"><code>${escape(text)}</code></pre></div>`;
  };
  // The source article is Markdown-only. Do not execute raw HTML in this first renderer.
  renderer.html = ({ text }) => text.trim().startsWith('<!--') ? '' : escape(text);
  const table = Renderer.prototype.table;
  renderer.table = function (token) {
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="比較表">${table.call(this, token)}</div>`;
  };
  const parser = new Marked({ renderer, gfm: true });
  return { html: parser.parse(body, { async: false }), headings };
}

// Keep the supplied notes readable without creating a second Markdown content system.
// Anchor markers allow links into the original investigation record to keep working.
export function renderSource(source: string) {
  const seen = new Set<string>();
  return source.split('\n').map(line => {
    const explicit = line.match(/\bid=["']([^"']+)["']/)?.[1];
    const heading = line.match(/^#{1,6}\s+(.+)/)?.[1];
    const id = explicit || (heading ? slug(heading) : '');
    if (id && !seen.has(id)) {
      seen.add(id);
      return `<span id="${escape(id)}">${escape(line)}</span>`;
    }
    return escape(line);
  }).join('\n');
}
