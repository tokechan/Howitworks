import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import vue from '@vitejs/plugin-vue';
import solid from 'vite-plugin-solid';
import { Hono } from 'hono';
import { html } from 'hono/html';
import * as pagefind from 'pagefind';
const run=path.resolve('generated/islands-'+Date.now());
const results=[];
await mkdir(run,{recursive:true});
const reactSource=`import { useState } from 'react';
import { createRoot } from 'react-dom/client';
function Counter() {
  const [count,setCount]=useState(0);
  return <section><p>React: <output>{count}</output></p><button onClick={()=>setCount(count+1)}>React +1</button></section>;
}
function FeedProbe() {
  const [items,setItems]=useState([]);
  const [message,setMessage]=useState('未取得');
  const labels=items.map(item=>item.title);
  async function load(fail=false) {try { const r=await fetch(import.meta.env.BASE_URL+'fixtures/'+(fail?'missing':'items')+'.json'); if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();setItems(data.items);setMessage('取得成功'); }catch {setMessage('取得失敗 — 前の一覧を保持');}}
  return <section aria-label="Reactの検証用アイランド"><button onClick={()=>load()}>一覧を取得</button><button onClick={()=>load(true)}>取得失敗を試す</button><p role="status">{message}</p><ul>{labels.map((label,i)=><li key={i}>{label}</li>)}</ul></section>;
}
createRoot(document.getElementById('island')).render(<><Counter/><FeedProbe/></>);`;
const vueSource=`import { createApp, ref } from 'vue';
import Counter from './Counter.vue'; createApp(Counter).mount('#island');`;
const solidSource=`import { createSignal } from 'solid-js'; import { render } from 'solid-js/web';
function Counter(){const [count,setCount]=createSignal(0);return <section><p>Solid: <output>{count()}</output></p><button onClick={()=>setCount(n=>n+1)}>Solid +1</button></section>;}render(()=> <Counter/>,document.getElementById('island'));`;
for (const scenario of [
  {id:'react-compiler-root',kind:'react',compiler:true,base:'/'},
  {id:'react-compiler-subpath',kind:'react',compiler:true,base:'/Howitworks/'},
  {id:'react-without-compiler',kind:'react',compiler:false,base:'/'},
  {id:'solid',kind:'solid',base:'/solid/'},
  {id:'vue',kind:'vue',base:'/vue/'},
]) {
  const root=path.join(run,scenario.id); await mkdir(root,{recursive:true});
  const entry=scenario.kind==='vue'?'main.js':'main.jsx';
  await writeFile(path.join(root,entry),scenario.kind==='vue'?vueSource:scenario.kind==='solid'?solidSource:reactSource);
  if(scenario.kind==='vue')await writeFile(path.join(root,'Counter.vue'),'<script setup>import { ref } from "vue";const count=ref(0);</script><template><section><p>Vue: <output>{{count}}</output></p><button @click="count++">Vue +1</button></section></template>');
  const app=new Hono();
  app.get('/',c=>c.html(html`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>隔離した実現可能性の検証</title></head><body><h1>検証用 — 製品UIではありません</h1><main data-pagefind-body><h2>静的な記事</h2><p id="static-text">パイプラインの説明は、JavaScriptがなくても読めます。</p></main><div id="island" data-pagefind-ignore>島の読み込み前</div><p><a href="${scenario.base}search.html">検索検証へ</a></p><script type="module" src="./${entry}"></script></body></html>`));
  await writeFile(path.join(root,'index.html'),await (await app.request('/')).text());
  try {
    const compilerEvents=[];
    const plugins=scenario.kind==='react'?[react(),...(scenario.compiler?[babel({presets:[reactCompilerPreset({logger:{logEvent(filename,event){compilerEvents.push({filename,...event});}}})]})]:[])]:scenario.kind==='solid'?[solid()]:[vue()];
    await build({root,configFile:false,base:scenario.base,plugins,build:{outDir:'dist',emptyOutDir:false,manifest:true,minify:false,sourcemap:false},logLevel:'warn'});
    const dist=path.join(root,'dist');const manifest=JSON.parse(await readFile(path.join(dist,'.vite/manifest.json'),'utf8'));
    const jsFiles=(await readdir(path.join(dist,'assets'))).filter(x=>x.endsWith('.js'));
    const chunks=await Promise.all(jsFiles.map(f=>readFile(path.join(dist,'assets',f),'utf8')));
    const code=chunks.join('\n');
    const memo=code.includes('react.memo_cache_sentinel');
    const counterCompiled=compilerEvents.some(event=>event.kind==='CompileSuccess'&&event.fnName==='Counter');
    if(scenario.compiler)assert.ok(counterCompiled,'Compiler must report successful Counter transformation; a runtime marker alone is insufficient');
    const output=await readFile(path.join(dist,'index.html'),'utf8');
    assert.ok(output.includes('パイプライン'));assert.ok(output.includes(scenario.base+'assets/'));
    for(const m of Object.values(manifest))if(m.isEntry)assert.ok(jsFiles.includes(path.basename(m.file)));
    await mkdir(path.join(dist,'fixtures'));
    await writeFile(path.join(dist,'fixtures/items.json'),JSON.stringify({items:[{title:'LiveFeedUniqueMarker'}, {title:'<b>タイトルはHTMLとして実行しない</b>'}]}));
    const {index}=await pagefind.createIndex({});
    const added=await index.addHTMLFile({url:scenario.base,content:output});assert.equal(added.errors.length,0);
    const written=await index.writeFiles({outputPath:path.join(dist,'pagefind')});assert.equal(written.errors.length,0);
    await writeFile(path.join(dist,'search.html'),`<!DOCTYPE html><html lang="ja"><title>検索検証</title><h1>Pagefindの検証</h1><button id="search">静的記事と動的一覧を検索</button><pre id="result">未実行</pre><script type="module">const pagefind=await import('${scenario.base}pagefind/pagefind.js');document.getElementById('search').onclick=async()=>{const a=await pagefind.search('パイプライン');const b=await pagefind.search('LiveFeedUniqueMarker');document.getElementById('result').textContent=JSON.stringify({staticResults:a.results.length,dynamicResults:b.results.length});};</script></html>`);
    const result={...scenario,status:'passed',manifestEntries:Object.keys(manifest),jsBytes:Buffer.byteLength(code),gzipBytes:gzipSync(code).byteLength,compilerMemoMarker:memo,counterCompiled,compilerEvents,dist};
    results.push(result);console.log(JSON.stringify(result));
  }catch(error) {const result={...scenario,status:'failed',error:error.stack};results.push(result);console.error(result);}
}
await pagefind.close();
await writeFile('evidence/islands.json',JSON.stringify({run,checkedAt:new Date().toISOString(),results,note:'Bundle sizes from unminified small fixtures, not equal application features or production benchmarks.'},null,2));
if(results.some(x=>x.status==='failed'))process.exitCode=1;
