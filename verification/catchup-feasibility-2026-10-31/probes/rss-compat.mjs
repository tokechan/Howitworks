import { createRequire, builtinModules } from 'node:module';
import { build } from 'esbuild';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../node_modules/wrangler/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const run='generated/rss-compat-'+Date.now();await mkdir(run,{recursive:true});
const built=await build({stdin:{contents:'import Parser from "rss-parser"; export default {async fetch(request){const feed=await new Parser().parseString(await request.text());return Response.json({count:feed.items.length,title:feed.items[0].title});}};',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false,banner:{js:'import { createRequire } from "node:module"; const require = createRequire("/");'},plugins:[{name:'explicit-node-builtins',setup(b){b.onResolve({filter:/^[\w_]+$/},args=>builtinModules.includes(args.path)?{path:'node:'+args.path,external:true}:null);}}]});
await writeFile(run+'/worker.mjs',built.outputFiles[0].text);
const results=[];
const fixture=await readFile('evidence/feeds/hono-releases.xml','utf8');
for(const [mode,flags] of [['default',[]],['explicit-on',['nodejs_compat']],['explicit-off',['no_nodejs_compat','no_nodejs_compat_v2']]]) {
  const mf=new Miniflare(convertV4MiniflareOptions({name:'rss-parser-probe',host:'127.0.0.1',port:0,modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-30',compatibilityFlags:flags,cf:false,telemetry:{enabled:false},resourcePersistencePath:run+'/'+mode+'/state',resourceTmpPath:run+'/'+mode+'/tmp',unsafeDevRegistryPath:run+'/'+mode+'/registry'}));
  try {await mf.ready;const response=await mf.dispatchFetch('http://probe/parse',{method:'POST',body:fixture});const result=await response.json();assert.equal(result.count,10);results.push({mode,flags,passed:true,result});}
  catch(error){results.push({mode,flags,passed:false,error:String(error)});}
  finally {try {await mf.dispose();} catch(error) {results.at(-1).disposeError=String(error);}}
}
console.log(JSON.stringify(results,null,2));
await writeFile('evidence/rss-compat.json',JSON.stringify({checkedAt:new Date().toISOString(),run,results,bundleBytes:built.outputFiles[0].contents.length},null,2));
assert.equal(results[0].passed,true);assert.equal(results[1].passed,true);assert.equal(results[2].passed,false);
