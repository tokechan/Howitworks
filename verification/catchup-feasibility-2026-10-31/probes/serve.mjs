import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const {results}=JSON.parse(await readFile('evidence/islands.json','utf8'));
const roots=Object.fromEntries(results.filter(x=>x.status==='passed').map(x=>[x.id,x.dist]));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.css':'text/css'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.searchParams.get('scripts')==='off')res.setHeader('Content-Security-Policy',"script-src 'none'");
    const scenario=url.pathname.startsWith('/Howitworks/')?'react-compiler-subpath':url.pathname.startsWith('/solid/')?'solid':url.pathname.startsWith('/vue/')?'vue':'react-compiler-root';
    let route=decodeURIComponent(url.pathname.replace(/^\/(Howitworks|solid|vue)\//,'/'));
    const root=roots[scenario];let target=path.resolve(root,'.'+route);
    if(target!==root&&!target.startsWith(root+path.sep))throw new Error('Invalid path');
    if((await stat(target)).isDirectory())target=path.join(target,'index.html');
    res.setHeader('content-type',mime[path.extname(target)]||'application/octet-stream');
    res.end(await readFile(target));
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(4497,'127.0.0.1',()=>console.log('VERIFICATION ONLY http://127.0.0.1:4497 — root React, /Howitworks/ React, /solid/, /vue/'));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));
