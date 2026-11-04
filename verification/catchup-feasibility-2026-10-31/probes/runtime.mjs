import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
// The current stable Wrangler ships this beta internally. Testing it is not adoption.
const require=createRequire(new URL('../node_modules/wrangler/package.json',import.meta.url));
const { Miniflare, convertV4MiniflareOptions }=require('miniflare');
const run='generated/runtime-'+Date.now();
const compatibilityDate=process.argv[2]||'2026-10-31';
await mkdir(run,{recursive:true});
const built=await build({entryPoints:['probes/worker-fixture.mjs'],bundle:true,format:'esm',platform:'browser',write:false,metafile:true});
await writeFile(run+'/worker.mjs',built.outputFiles[0].text);
const observations=[];
const ok=(name,details={})=>{observations.push({name,passed:true,...details});console.log('PASS',name,details);};
let mode='ok';let lastEtag=null;
const realFeeds=Object.fromEntries(await Promise.all(['cloudflare-workers','hono-releases','cloudflare-changelog'].map(async id=>[id,await readFile('evidence/feeds/'+id+'.xml','utf8')])));
const sample=title=>`<rss version="2.0"><channel><title>Probe</title><item><guid>same-id</guid><title>${title}</title><link>https://example.com/article</link></item></channel></rss>`;
const mf=new Miniflare(convertV4MiniflareOptions({
  name:'catchup-probe',host:'127.0.0.1',port:0,modules:true,script:built.outputFiles[0].text,
  compatibilityDate,compatibilityFlags:['no_nodejs_compat','no_nodejs_compat_v2'],cf:false,telemetry:{enabled:false},
  resourcePersistencePath:run+'/state',isolatedResourcePersistencePath:run+'/isolated',resourceTmpPath:run+'/tmp',
  unsafeDevRegistryPath:run+'/registry',
  d1Databases:{DB:'probe-database'},serviceBindings:{FEED:request=>{
    lastEtag=request.headers.get('if-none-match');
    if(mode==='304')return new Response(null,{status:304});
    if(mode==='http-error')return new Response('test failure',{status:503});
    if(mode==='invalid')return new Response('<rss><channel></rss>');
    if(realFeeds[mode])return new Response(realFeeds[mode]);
    return new Response(sample(mode==='changed'?'Changed title':'Original title'),{headers:{etag:'"probe-1"'}});
  }}
}));
try {
  await mf.ready;
  const db=await mf.getD1Database('DB');
  await db.exec('CREATE TABLE items(source TEXT NOT NULL,id TEXT NOT NULL,title TEXT NOT NULL,url TEXT NOT NULL,published_at TEXT,updated_at TEXT,first_seen TEXT NOT NULL,PRIMARY KEY(source,id)); CREATE TABLE sources(id TEXT PRIMARY KEY,etag TEXT,status TEXT,last_checked TEXT);');
  const worker=await mf.getWorker();
  const tick=async()=>{const result=await worker.scheduled({cron:'0 * * * *',scheduledTime:new Date()});assert.equal(result.outcome,'ok');};
  const rows=async()=>{const response=await mf.dispatchFetch('http://probe/items',{headers:{Origin:'https://blog.example'}});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'https://blog.example');return (await response.json()).items;};
  await tick();const initial=await rows();assert.equal(initial.length,1);assert.equal(initial[0].published_at,null);
  ok('Hono + XML parser + D1 in actual workerd without nodejs_compat',{rows:1,bytes:built.outputFiles[0].contents.length});
  await tick();assert.equal((await rows()).length,1);assert.equal(lastEtag,'"probe-1"');ok('Repeated scheduled delivery is idempotent; conditional header emitted');
  mode='changed';await tick();assert.equal((await rows())[0].title,'Changed title');assert.equal((await rows())[0].first_seen,initial[0].first_seen);ok('Same entry updates title, preserves first-seen timestamp');
  const saved=await rows();
  for(const failure of ['304','http-error','invalid']) { mode=failure;await tick();assert.deepEqual(await rows(),saved);const state=await db.prepare('SELECT status FROM sources').first();assert.match(state.status,failure==='304'?/not-modified/:/^error:/);ok('Existing rows preserved on '+failure,{state:state.status}); }
  await assert.rejects(db.batch([
    db.prepare('INSERT INTO items VALUES(?,?,?,?,?,?,?)').bind('rollback','x','temporary','https://example.com',null,null,'now'),
    db.prepare('INSERT INTO table_that_does_not_exist VALUES(?)').bind('bad')
  ]));
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM items WHERE source='rollback'").first()).n,0);ok('D1 batch rollback on second statement failure');
  const denied=await mf.dispatchFetch('http://probe/items',{headers:{Origin:'https://unlisted.example'}});assert.notEqual(denied.headers.get('access-control-allow-origin'),'https://unlisted.example');ok('Other browser origin not granted CORS; API remains public, not authorization');
  for(const [feed,expectedRows] of [['cloudflare-workers',279],['hono-releases',289]]) {
    mode=feed;const started=performance.now();await tick();
    const count=(await db.prepare('SELECT COUNT(*) AS n FROM items').first()).n;
    assert.equal(count,expectedRows);ok('Actual saved '+feed+' parsed and stored inside workerd',{rows:count,localWallMs:Math.round(performance.now()-started)});
  }
  mode='cloudflare-changelog';await tick();assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM items').first()).n,289);
  assert.match((await db.prepare('SELECT status FROM sources').first()).status,/byte limit/);ok('Actual 8.8 MB feed rejected by experimental 4 MiB cap; stored rows survive');
} finally { await mf.dispose(); }

// Inspect the compatibility cost of the alternative parser, without silently polyfilling it.
let alternate;
try {
  await build({stdin:{contents:'import Parser from "rss-parser"; export default new Parser();',resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',write:false,logLevel:'silent'});
  alternate={browserBundle:true};
} catch(error) {alternate={browserBundle:false,unresolved:error.errors?.map(x=>x.text)};}
console.log('rss-parser browser target:',alternate);
await writeFile('evidence/runtime-'+compatibilityDate+'.json',JSON.stringify({checkedAt:new Date().toISOString(),miniflare:require('miniflare/package.json').version,workerd:require('workerd/package.json').version,compatibilityDateRequested:compatibilityDate,compatibilityFlags:['no_nodejs_compat','no_nodejs_compat_v2'],observations,alternateParser:alternate,run},null,2));
