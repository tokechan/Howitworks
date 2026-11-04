import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const jobs = {
  versions: ['node', 'probes/versions.mjs'],
  feeds: ['node', 'probes/feeds.mjs'],
  'feeds-extra': ['node', 'probes/feeds-extra.mjs'],
  audit: ['node', 'probes/lock-audit.mjs'],
  parser: ['node', '--test', 'probes/parser.test.mjs'],
  runtime: ['node', 'probes/runtime.mjs'],
  'runtime-compatible': ['node', 'probes/runtime.mjs', '2026-10-30'],
  minimal: ['node', 'probes/minimal-dependencies.mjs'],
  'rss-compat': ['node', 'probes/rss-compat.mjs'],
  'node-matrix': ['node', 'probes/node-matrix.mjs'],
  islands: ['node', 'probes/islands.mjs'],
  preservation: ['node', 'probes/preservation.mjs'],
};
const ids = process.argv.slice(2);
if (!ids.length || ids.some(id => !jobs[id])) throw new Error('Choose: '+Object.keys(jobs).join(', '));
const run = new Date().toISOString().replaceAll(':','-')+'-'+ids.join('-');
const dir = path.join(root, 'runs', run);
await mkdir(dir, {recursive:true});
const records = [];
for (const id of ids) {
  const [cmd, ...args] = jobs[id];
  const startedAt = new Date().toISOString();
  const child = spawn(cmd, args, {cwd:root, env:{PATH:process.env.PATH, TMPDIR:process.env.TMPDIR, LANG:'en_US.UTF-8', WRANGLER_SEND_METRICS:'false'}, stdio:['ignore','pipe','pipe']});
  let output='';
  for (const stream of [child.stdout,child.stderr]) stream.on('data', chunk => { output+=chunk; process.stdout.write(chunk); });
  const code = await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
  await writeFile(path.join(dir,id+'.log'),output);
  records.push({id, command:[cmd,...args], startedAt, finishedAt:new Date().toISOString(), exitCode:code, status:code===0?'passed':'failed'});
}
await writeFile(path.join(dir,'results.json'),JSON.stringify(records,null,2)+'\n');
console.log('Evidence:',dir);
if(records.some(x=>x.exitCode!==0))process.exitCode=1;
