import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const dir=path.resolve('generated/dependency-alternative-'+Date.now());
await mkdir(dir,{recursive:true});
const manifest=JSON.parse(await readFile('package.json','utf8'));
const dependencies=Object.fromEntries(['hono','fast-xml-parser','wrangler'].map(name=>[name,manifest.dependencies[name]]));
await writeFile(dir+'/package.json',JSON.stringify({name:'feasibility-alternative-not-adopted',private:true,dependencies},null,2));
await writeFile(dir+'/.npmrc','registry=https://registry.npmjs.org/\nmin-release-age=3\nignore-scripts=true\naudit=false\nfund=false\n');
const {cutoff}=JSON.parse(await readFile('evidence/versions.json','utf8'));
const args=['--userconfig='+path.resolve('isolated-user.npmrc'),'--cache='+path.resolve('.npm-cache')];
const lock=spawnSync('npm',['install','--package-lock-only','--ignore-scripts','--strict-peer-deps','--before='+cutoff,...args],{cwd:dir,encoding:'utf8',env:process.env});
await writeFile(dir+'/install.log',lock.stdout+lock.stderr);if(lock.status)throw new Error(lock.stderr);
const audit=spawnSync('npm',['audit','--json',...args],{cwd:dir,encoding:'utf8',env:process.env});
await writeFile(dir+'/npm-audit.json',audit.stdout);
const auditData=JSON.parse(audit.stdout);
const packages=Object.entries(JSON.parse(await readFile(dir+'/package-lock.json','utf8')).packages).filter(([p])=>p);
const original=JSON.parse(await readFile('evidence/lock-audit.json','utf8'));
const originalLock=JSON.parse(await readFile('package-lock.json','utf8'));
const checks=[];
for(const [location,p] of packages) {
  const name=location.split('node_modules/').at(-1);
  let record=original.records.find(x=>x.name===name&&x.version===p.version);
  if(!record) {
    const response=await fetch('https://registry.npmjs.org/'+encodeURIComponent(name),{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(name);
    const meta=await response.json();record={publishedAt:meta.time[p.version],integrity:meta.versions[p.version].dist.integrity};
  } else record={publishedAt:record.publishedAt,integrity:record.integrityMatches?originalLock.packages[record.location]?.integrity:null};
  checks.push({name,version:p.version,publishedAt:record.publishedAt,agePass:Date.parse(record.publishedAt)<=Date.parse(cutoff),registryPass:p.resolved.startsWith('https://registry.npmjs.org/'),integrityPass:record.integrity===p.integrity});
}
const violations=checks.filter(x=>!x.agePass||!x.registryPass||!x.integrityPass);
const result={dir,checkedAt:new Date().toISOString(),cutoff,dependencies,auditExit:audit.status,auditSummary:auditData.metadata?.vulnerabilities,checks,violations,note:'Metadata/lockfile-only alternative. No application dependency adoption or package execution.'};
await writeFile('evidence/minimal-dependencies.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,checks:checks.length},null,2));
if(violations.length)process.exitCode=1;
