import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import RSSParser from 'rss-parser';
import { normalize, boundedText } from './feed-adapter.mjs';
const base = 'https://example.com/feed.xml';
const rss = entries => `<rss version="2.0"><channel><title>Probe</title>${entries}</channel></rss>`;
test('RSS identity, missing dates, relative links, deduplication, body exclusion',()=>{
  const xml=rss('<item><guid>x</guid><title>First</title><link>/x</link></item><item><guid>x</guid><title>Updated &amp; valid</title><link>/x</link><description>NOT_STORED</description></item>');
  const result=normalize(xml,base);
  assert.equal(result.items.length,1); assert.equal(result.items[0].title,'Updated & valid');
  assert.equal(result.items[0].publishedAt,null); assert.equal(result.items[0].url,'https://example.com/x');
  assert.ok(!JSON.stringify(result).includes('NOT_STORED'));
});
test('Atom namespaced entry selects alternate HTML link and distinguishes updated from published',()=>{
  const xml='<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>urn:1</id><title>Atom</title><link rel="self" href="/api"/><link rel="alternate" href="/article"/><updated>2026-10-30T00:00:00Z</updated></entry></feed>';
  const [item]=normalize(xml,base).items;
  assert.equal(item.url,'https://example.com/article');assert.equal(item.publishedAt,null);assert.equal(item.updatedAt,'2026-10-30T00:00:00.000Z');
});
test('bad XML, non-feed, DTD and unsafe link handling',()=>{
  for(const xml of ['<rss><channel></rss>','<html/>','<!DOCTYPE rss><rss/>'])assert.throws(()=>normalize(xml,base));
  const result=normalize(rss('<item><title>Unsafe</title><link>javascript:alert(1)</link></item><item><title>Missing</title></item>'),base);
  assert.equal(result.items.length,0);assert.equal(result.rejected,2);
});
test('title is plain data; markup stays text for escaping at render time',()=>{
  const [item]=normalize(rss('<item><title><![CDATA[<b>Title</b>]]></title><link>/safe</link></item>'),base).items;
  assert.equal(item.title,'<b>Title</b>');
});
test('streaming cap rejects an oversized response without depending on Content-Length',async()=>{
  await assert.rejects(boundedText(new Response('abcdef'),5),/limit/);
  assert.equal(await boundedText(new Response('abc'),5),'abc');
});
test('actual feeds: compare entry counts and parser timings in Node, not cloud CPU',async()=>{
  const results=[];
  for(const name of (await readdir('evidence/feeds')).filter(x=>x.endsWith('.xml'))) {
    const xml=await readFile('evidence/feeds/'+name,'utf8');
    let start=performance.now();const normalized=normalize(xml,base,100000);const adapterMs=performance.now()-start;
    start=performance.now();const generic=await new RSSParser().parseString(xml);const rssParserMs=performance.now()-start;
    assert.ok(normalized.items.length>0,name);
    assert.equal(normalized.totalEntries,generic.items.length,name);
    const result={feed:name,bytes:Buffer.byteLength(xml),entries:normalized.totalEntries,accepted:normalized.items.length,rejected:normalized.rejected,adapterMs:Math.round(adapterMs),rssParserMs:Math.round(rssParserMs),sample:normalized.items[0]};
    results.push(result);console.log(JSON.stringify(result));
  }
  await writeFile('evidence/parser.json',JSON.stringify(results,null,2));
});
