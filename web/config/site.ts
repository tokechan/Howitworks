import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const webRoot = fileURLToPath(new URL('../', import.meta.url));
export const projectRoot = path.resolve(webRoot, '..');
export const articleId = 'brotli-cve-2026-111497';

export function getConfig(env: NodeJS.ProcessEnv = process.env) {
  const base = env.SITE_BASE || '/';
  if (!/^\/(?:[\w-]+\/)*$/.test(base)) {
    throw new Error('SITE_BASE must be / or /path/ with a trailing slash.');
  }
  const includeDrafts = env.INCLUDE_DRAFTS === '1';
  const outDir = path.join(webRoot, env.SITE_BASE ? '.generated/base-site' : 'dist');
  return { base, includeDrafts, outDir, href: (url = '') => base + url.replace(/^\//, '') };
}

export type SiteConfig = ReturnType<typeof getConfig>;
