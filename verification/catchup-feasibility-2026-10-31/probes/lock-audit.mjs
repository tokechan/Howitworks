import { readFile, writeFile } from 'node:fs/promises';
const {cutoff}=JSON.parse(await readFile('evidence/versions.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const packages=Object.entries(lock.packages).filter(([p])=>p).map(([location,p])=>({location,name:location.split('node_modules/').at(-1),...p}));
const names=[...new Set(packages.map(p=>p.name))];
const records=[];
for(let i=0;i<names.length;i+=6){
 await Promise.all(names.slice(i,i+6).map(async name=>{
  const res=await fetch('https://registry.npmjs.org/'+encodeURIComponent(name),{signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw new Error(`${name}: HTTP ${res.status}`);
  const meta=await res.json();
  for(const p of packages.filter(p=>p.name===name)){
   const publishedAt=meta.time?.[p.version];
   records.push({name,version:p.version,location:p.location,publishedAt,eligible:!!publishedAt&&Date.parse(publishedAt)<=Date.parse(cutoff),registry:p.resolved?.startsWith('https://registry.npmjs.org/')??false,integrityMatches:!!p.integrity&&p.integrity===meta.versions[p.version]?.dist?.integrity,prerelease:p.version.includes('-'),deprecated:meta.versions[p.version]?.deprecated||null,engines:p.engines,installScript:meta.versions[p.version]?.scripts?.install||meta.versions[p.version]?.scripts?.postinstall||null});
  }
 }));
 console.log(`Checked registry metadata ${Math.min(i+6,names.length)}/${names.length}`);
}
const violations=records.filter(x=>!x.eligible||!x.registry||!x.integrityMatches);
const result={checkedAt:new Date().toISOString(),cutoff,lockedPackages:records.length,distinctPackages:names.length,violations,prereleases:records.filter(x=>x.prerelease),deprecated:records.filter(x=>x.deprecated),installScripts:records.filter(x=>x.installScript),records};
await writeFile('evidence/lock-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({lockedPackages:result.lockedPackages,violations,prereleases:result.prereleases.map(x=>({name:x.name,version:x.version})),deprecated:result.deprecated.map(x=>({name:x.name,version:x.version,reason:x.deprecated})),installScripts:result.installScripts.map(x=>({name:x.name,script:x.installScript}))},null,2));
if(violations.length)process.exitCode=1;
