import * as fs from 'node:fs/promises';
import path from 'node:path';
import { build as viteBuild } from 'vite';
import { toSSG } from 'hono/ssg';
import { getConfig, projectRoot, webRoot } from '../config/site.ts';
import { articleImage, simulatorFiles } from '../config/resources.ts';
import { loadArticle, isVisible } from '../src/content/article.ts';
import { createApp } from '../src/server/app.ts';

const config = getConfig();
const article = await loadArticle();
const visible = isVisible(article, config.includeDrafts);
const clientDir = path.join(webRoot, '.generated/client');
console.log(`[1/4] 原稿を読込: ${article.id} (${visible ? '表示対象' : '下書きのため除外'})`);

// Vite builds CSS at this stage. Browser JavaScript starts with the islands phase.
await viteBuild({
  root: webRoot, configFile: false, base: config.base,
  build: {
    outDir: clientDir, emptyOutDir: true, manifest: true,
    rolldownOptions: { input: path.join(webRoot, 'src/styles/site.css') },
  },
});
const manifest = JSON.parse(await fs.readFile(path.join(clientDir, '.vite/manifest.json'), 'utf8'));
const entry = manifest['src/styles/site.css'];
if (!entry || !entry.file.endsWith('.css')) throw new Error('Vite CSS entry is missing from manifest.');
const css = config.href(entry.file);
console.log(`[2/4] Vite manifestからCSSを解決: ${css}`);

// Only our generated target is removed. Existing site/ and original content are read-only.
await fs.rm(config.outDir, { recursive: true, force: true });
await fs.mkdir(config.outDir, { recursive: true });
await fs.cp(path.join(clientDir, 'assets'), path.join(config.outDir, 'assets'), { recursive: true });
const app = await createApp(config, css, article);
const result = await toSSG(app, fs, {
  dir: config.outDir,
  plugins: [{ afterResponseHook(response) {
    if (!response.ok) throw new Error(`HTML generation returned HTTP ${response.status}.`);
    return response;
  } }],
});
if (!result.success) throw result.error || new Error('Hono static generation failed.');
console.log(`[3/4] Honoの応答をHTMLへ保存: ${result.files.length} pages`);

if (visible) {
  // Minimal support for links already in the article; full resource integration is phase 6.
  await fs.mkdir(path.join(config.outDir, 'media'), { recursive: true });
  await fs.copyFile(path.join(projectRoot, articleImage), path.join(config.outDir, 'media/patch-flow.jpg'));
  await fs.mkdir(path.join(config.outDir, 'demos/brotli'), { recursive: true });
  for (const name of simulatorFiles) {
    await fs.copyFile(path.join(projectRoot, 'simulators/brotli/dist', name), path.join(config.outDir, 'demos/brotli', name));
  }
}
await fs.writeFile(path.join(config.outDir, 'build-info.json'), JSON.stringify({
  phase: 1, base: config.base, includeDrafts: config.includeDrafts, article: visible ? article.id : null,
  css, generatedAt: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`[4/4] 完了: ${config.outDir}`);
