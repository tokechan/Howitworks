// Exact allowlist of data created during this verification. Never general cleanup.
import {readFile,writeFile,realpath,lstat,rm} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const lab='/Users/svc-tokeshi/dev/Howitworks/verification/catchup-feasibility-2026-10-31';
assert.equal(await realpath(process.cwd()),lab);
const before=JSON.parse(await readFile('baseline.json','utf8'));
const relativeLab='verification/catchup-feasibility-2026-10-31/';
const paths=[
  '.npm-cache',
  'node_modules',
  'generated/node-matrix-1793418884908/v24.22.2/node-v24.22.2-darwin-arm64.tar.gz',
  'generated/node-matrix-1793418884908/v24.22.2/node-v24.22.2-darwin-arm64',
  'generated/node-matrix-1793418884908/v26.12.1/node-v26.12.1-darwin-arm64.tar.gz',
  'generated/node-matrix-1793418884908/v26.12.1/node-v26.12.1-darwin-arm64',
];
const removed=[];
for(const relative of paths) {
  const target=path.resolve(lab,relative);assert.ok(target.startsWith(lab+'/'));
  assert.ok(!before.existingPaths.some(p=>p===relativeLab+relative||p.startsWith(relativeLab+relative+'/')),'Target overlaps pre-existing baseline');
  const info=await lstat(target);assert.ok(!info.isSymbolicLink());assert.equal(await realpath(target),target);
  await rm(target,{recursive:info.isDirectory(),force:false});removed.push(target);console.log('Removed new verification data:',relative);
}
await writeFile('evidence/cleanup.json',JSON.stringify({checkedAt:new Date().toISOString(),removed,retained:'Probe code, manifests, lockfiles, registry metadata, saved feeds, generated fixture builds, test logs, SHA256 records and reports',authority:'User explicitly allowed deleting data newly created for verification; no pre-existing project path is in this allowlist.'},null,2));
