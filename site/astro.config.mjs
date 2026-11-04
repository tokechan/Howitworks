import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { base, outDir, siteOrigin } from './scripts/config.mjs';
import { contentTransforms, readableTables } from './scripts/markdown.mjs';

export default defineConfig({
  output: 'static',
  site: siteOrigin,
  base,
  trailingSlash: 'always',
  publicDir: './.generated/public',
  outDir,
  devToolbar: { enabled: false },
  markdown: {
    shikiConfig: { theme: 'github-light' },
    processor: unified({
      remarkPlugins: [contentTransforms],
      rehypePlugins: [readableTables],
    }),
  },
});
