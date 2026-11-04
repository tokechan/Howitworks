// A build-backed local server: Pagefind searches the same HTML being served.
import { spawn } from 'node:child_process';
process.env.INCLUDE_DRAFTS = '1';
const child = spawn(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit', env: process.env });
const code = await new Promise(resolve => child.on('exit', resolve));
if (code !== 0) process.exit(Number(code) || 1);
await import('./serve.mjs');
