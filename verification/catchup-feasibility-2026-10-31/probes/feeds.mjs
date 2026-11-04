import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('evidence/feeds',{recursive:true});
const targets=[
 ['cloudflare-workers','https://developers.cloudflare.com/changelog/rss/workers.xml','rss'],
 ['cloudflare-changelog','https://developers.cloudflare.com/changelog/rss/index.xml','rss'],
 ['react-blog','https://react.dev/blog','discover'],
 ['vite-blog','https://vite.dev/blog','discover'],
 ['hono-releases','https://github.com/honojs/hono/releases.atom','atom'],
 ['vite-releases','https://github.com/vitejs/vite/releases.atom','atom'],
 ['react-releases','https://github.com/facebook/react/releases.atom','atom'],
];
const results=[];
for(const [id,url,kind] of targets){
 try {
  const response=await fetch(url,{headers:{'User-Agent':'Howitworks-Feasibility/0.1 (manual public feed validation)'},signal:AbortSignal.timeout(20000)});
  const text=await response.text();
  const headers=Object.fromEntries(['content-type','etag','last-modified','cache-control'].map(k=>[k,response.headers.get(k)]));
  const discovered=[...text.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).filter(s=>/application\/(?:rss|atom)\+xml/i.test(s)).map(s=>({tag:s,url:new URL(s.match(/href=["']([^"']+)/i)?.[1]||'',response.url).href}));
  const result={id,url,kind,checkedAt:new Date().toISOString(),status:response.status,finalUrl:response.url,headers,bytes:Buffer.byteLength(text),feedRoot:(text.match(/<(rss|feed|rdf:RDF)\b/i)||[])[1]||null,discovered};
  if(kind!=='discover'&&response.ok&&result.feedRoot)await writeFile(`evidence/feeds/${id}.xml`,text);
  // Store only feed metadata for ordinary web pages, not unrelated page bodies.
  if(response.ok&&(headers.etag||headers['last-modified'])&&kind!=='discover'){
    const conditional=await fetch(url,{headers:headers.etag?{'If-None-Match':headers.etag}:{'If-Modified-Since':headers['last-modified']},signal:AbortSignal.timeout(20000)});
    result.conditionalStatus=conditional.status; await conditional.body?.cancel();
  }
  results.push(result);console.log(JSON.stringify(result));
 }catch(e){results.push({id,url,error:e.message});console.log(id,e.message);}
}
await writeFile('evidence/feeds.json',JSON.stringify(results,null,2)+'\n');
if(!results.some(x=>x.status===200&&x.feedRoot))process.exitCode=1;
