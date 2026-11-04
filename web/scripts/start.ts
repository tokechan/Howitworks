import { spawn } from 'node:child_process';
import { getConfig, webRoot } from '../config/site.ts';
import { startServer } from './serve.ts';

// dev is a build-backed local preview; source drafts remain unchanged.
process.env.INCLUDE_DRAFTS = '1';
const build = spawn(process.execPath, ['scripts/build.ts'], { cwd: webRoot, stdio: 'inherit', env: process.env });
const code = await new Promise<number | null>((resolve, reject) => { build.once('exit', resolve); build.once('error', reject); });
if (code !== 0) process.exit(code || 1);
const server = await startServer(getConfig().outDir, Number(process.env.PORT || 4331));
process.once('SIGINT', () => server.close());
process.once('SIGTERM', () => server.close());
