import { spawn } from 'node:child_process';
import path from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { siteRoot, projectRoot, outDir, href, articleId, includeDrafts, siteOrigin } from './config.mjs';
import { hasBrotli } from './prepare.mjs';

function run(bin, args, cwd = siteRoot, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: 'inherit', env: { ASTRO_TELEMETRY_DISABLED: '1', ...process.env, ...extraEnv } });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}`)));
  });
}
await run(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build']);
if (hasBrotli) {
  const talkRoot = path.join(projectRoot, 'talks/brotli');
  const deckBase = href('decks/brotli/');
  await run(process.execPath, ['scripts/prepare-assets.mjs'], talkRoot);
  await run(process.execPath, [
    'node_modules/@slidev/cli/bin/slidev.mjs', 'build', 'slides.md', '--base', deckBase,
    '--router-mode', 'hash', '--out', path.join(outDir, 'decks/brotli'),
  ], talkRoot, { VITE_HOWITWORKS_ARTICLE: href(`articles/${articleId}/`) });
  // Speaker notes contain an existing root-relative evidence link. Scope it to
  // this deck's own copied evidence directory in the assembled site only.
  async function fixNotes(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await fixNotes(file);
      else if (/\.(js|html)$/.test(entry.name)) {
        const source = await readFile(file, 'utf8');
        const updated = source.replaceAll('/evidence/result-2026-10-27.txt', `${deckBase}evidence/result-2026-10-27.txt`);
        if (updated !== source) await writeFile(file, updated);
      }
    }
  }
  await fixNotes(path.join(outDir, 'decks/brotli'));
}
await run(process.execPath, ['node_modules/pagefind/lib/runner/bin.cjs', '--site', outDir, '--force-language', 'ja', '--exclude-selectors', '[data-pagefind-ignore]']);
await writeFile(path.join(outDir, '.nojekyll'), '');
await writeFile(path.join(outDir, 'build-info.json'), JSON.stringify({ base: href(), origin: siteOrigin, drafts: includeDrafts, brotli: hasBrotli }));
console.log(`Built site, related experiences and search at ${outDir}`);
