import path from 'node:path';
import { documents, resolveContentLink } from './config.mjs';

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function contentTransforms() {
  return (tree, file) => {
    const basename = path.basename(file.path || '', '.md');
    const record = documents.find(d => d.id === basename);
    const source = record?.file || `articles/${basename}.md`;
    // The layout renders the title, keeping a single h1 on every page.
    tree.children = tree.children.filter(n => !(n.type === 'heading' && n.depth === 1));
    function walk(node) {
      if (node.type === 'link' || node.type === 'image') node.url = resolveContentLink(node.url, source);
      if (node.type === 'html') node.value = node.value.replace(/(href|src)="([^"]+)"/g, (_, attr, url) => `${attr}="${resolveContentLink(url, source)}"`);
      if (node.type === 'code' && node.lang === 'mermaid') {
        node.type = 'html';
        node.value = `<figure class="diagram"><div class="mermaid" aria-label="fetchとnode:httpの処理経路">${escape(node.value)}</div><figcaption>HTTP本文がアプリに届くまで。別々のリクエストの比較。</figcaption></figure>`;
      }
      node.children?.forEach(walk);
    }
    tree.children.forEach(walk);
  };
}

export function readableTables() {
  return tree => {
    function walk(node) {
      if (!node.children) return;
      node.children = node.children.map(child => {
        walk(child);
        if (child.tagName !== 'table') return child;
        return { type: 'element', tagName: 'div', properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: '比較表（横スクロールできます）' }, children: [child] };
      });
    }
    walk(tree);
  };
}
