import { mkdir, cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { siteRoot, projectRoot, documents, downloads, includeDrafts } from './config.mjs';

const publicDir = path.join(siteRoot, '.generated/public');
const recordsDir = path.join(siteRoot, '.generated/records');
await rm(publicDir, { recursive: true, force: true });
await rm(recordsDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await mkdir(recordsDir, { recursive: true });
await cp(path.join(siteRoot, 'public'), publicDir, { recursive: true });

// All current resources belong to the draft Brotli article. Exclude as a unit
// unless local preview was requested, or the article is explicitly published.
const article = await readFile(path.join(projectRoot, 'articles/brotli-cve-2026-111497.md'), 'utf8');
export const hasBrotli = includeDrafts || parseFrontmatter(article).frontmatter.status === 'published';
if (hasBrotli) {
  for (const doc of documents) {
    const markdown = await readFile(path.join(projectRoot, doc.file), 'utf8');
    const header = `---\ntitle: ${JSON.stringify(doc.label)}\nkind: ${JSON.stringify(doc.kind)}\nsource: ${JSON.stringify(doc.file)}\n---\n`;
    await writeFile(path.join(recordsDir, `${doc.id}.md`), header + markdown);
  }
  await cp(path.join(projectRoot, 'simulators/brotli/dist'), path.join(publicDir, 'demos/brotli'), { recursive: true });
  await cp(path.join(projectRoot, 'assets/brotli-pipeline'), path.join(publicDir, 'demos/pipeline'), { recursive: true });
  for (const dir of ['simulators/brotli/screenshots', 'talks/brotli/screenshots']) {
    await mkdir(path.join(publicDir, 'media'), { recursive: true });
    // Slidev's review screenshots are ignored by Git and absent on a fresh
    // checkout. Simulator evidence remains required, including patch-flow.jpg.
    const names = await readdir(path.join(projectRoot, dir)).catch(error => {
      if (dir === 'talks/brotli/screenshots' && error.code === 'ENOENT') return [];
      throw error;
    });
    for (const name of names) {
      if (!/\.(png|jpe?g|webp)$/.test(name)) continue;
      await cp(path.join(projectRoot, dir, name), path.join(publicDir, 'media', (dir.startsWith('talks') ? 'talk-' : '') + name));
    }
  }
  for (const file of [...downloads, 'assets/brotli-pipeline/README.md']) {
    const dest = path.join(publicDir, 'downloads', file + (file.endsWith('.txt') ? '' : '.txt'));
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(path.join(projectRoot, file), dest);
  }
}
for (const [pkg, name] of [['@fontsource-variable/inter', 'Inter'], ['@fontsource-variable/noto-sans-jp', 'Noto-Sans-JP']]) {
  await mkdir(path.join(publicDir, 'licenses'), { recursive: true });
  await cp(path.join(siteRoot, 'node_modules', pkg, 'LICENSE'), path.join(publicDir, 'licenses', `${name}.txt`));
}
console.log(`Prepared local assets${hasBrotli ? ' and Brotli evidence' : ' (draft excluded)'}.`);
