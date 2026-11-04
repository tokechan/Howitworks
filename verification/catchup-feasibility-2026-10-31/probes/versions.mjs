import { mkdir, writeFile } from 'node:fs/promises';
const observedAt = new Date().toISOString();
const cutoff = new Date(Date.parse(observedAt)-72*60*60*1000).toISOString();
const names = ['hono','vite','react','react-dom','@vitejs/plugin-react','babel-plugin-react-compiler','@rolldown/plugin-babel','@babel/core','typescript','@types/node','@types/react','@types/react-dom','@cloudflare/vite-plugin','wrangler','miniflare','fast-xml-parser','rss-parser','pagefind','solid-js','vite-plugin-solid','vue','@vitejs/plugin-vue','@tanstack/react-query','marked','yaml','zod','@slidev/cli','slidev-theme-geist','npm'];
await mkdir('evidence/registry',{recursive:true});
const cmp = (a,b) => { const x=a.split('.').map(Number), y=b.split('.').map(Number); for(let i=0;i<3;i++)if(x[i]!==y[i])return y[i]-x[i];return 0; };
const records=[];
for(let start=0;start<names.length;start+=4){
  await Promise.all(names.slice(start,start+4).map(async name=>{
    const url='https://registry.npmjs.org/'+encodeURIComponent(name);
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`${name}: ${response.status}`);
    const pack=await response.json();
    const stable=Object.keys(pack.versions).filter(v=>/^\d+\.\d+\.\d+$/.test(v)&&!pack.versions[v].deprecated).sort(cmp);
    const eligible=stable.filter(v=>pack.time[v] && Date.parse(pack.time[v])<=Date.parse(cutoff));
    const selected=eligible[0];
    const pick=v=>v?{version:v,publishedAt:pack.time[v],engines:pack.versions[v].engines,peers:pack.versions[v].peerDependencies,peerMeta:pack.versions[v].peerDependenciesMeta,dependencies:pack.versions[v].dependencies,optionalDependencies:pack.versions[v].optionalDependencies,scripts:pack.versions[v].scripts,dist:pack.versions[v].dist}:null;
    const record={name,source:url,distTags:pack['dist-tags'],latestStable:pick(stable[0]),eligible:pick(selected)};
    records.push(record);
    await writeFile('evidence/registry/'+name.replaceAll('/','__')+'.json',JSON.stringify({observedAt,cutoff,...record},null,2)+'\n');
    console.log(`${name}: latest ${stable[0]}, 72h eligible ${selected} (${pack.time[selected]})`);
  }));
}
const nodes=await fetch('https://nodejs.org/dist/index.json',{signal:AbortSignal.timeout(30000)}).then(r=>r.json());
const stableNodes=nodes.filter(n=>/^v\d+\.\d+\.\d+$/.test(n.version));
const nodeEligible=stableNodes.filter(n=>Date.parse(n.date+'T23:59:59Z')<=Date.parse(cutoff));
await writeFile('evidence/versions.json',JSON.stringify({observedAt,cutoff,hours:72,localNode:process.version,packages:records.sort((a,b)=>a.name.localeCompare(b.name)),node:{source:'https://nodejs.org/dist/index.json',latestRecord:nodes[0],latestStable:stableNodes[0],eligibleCurrent:nodeEligible[0],eligibleLts:nodeEligible.find(n=>n.lts),note:'Node feed dates have day precision; end-of-day UTC is used conservatively. Prereleases excluded from eligible candidates.'}},null,2)+'\n');
