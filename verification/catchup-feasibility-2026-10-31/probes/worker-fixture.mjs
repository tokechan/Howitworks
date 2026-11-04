// Test-only Worker. No public deployment/configuration exists for this fixture.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { normalize, boundedText } from './feed-adapter.mjs';
const app = new Hono();
app.use('/items', cors({ origin:'https://blog.example', allowMethods:['GET'] }));
app.get('/items', async c => {
  const { results } = await c.env.DB.prepare('SELECT * FROM items ORDER BY first_seen DESC LIMIT 50').all();
  return c.json({ items:results });
});

async function collect(env) {
  const source='test-feed';
  try {
    const state=await env.DB.prepare('SELECT etag FROM sources WHERE id=?').bind(source).first();
    // A local service binding replaces the network in this probe.
    const response=await env.FEED.fetch('https://feed.invalid/rss', {headers:state?.etag?{'If-None-Match':state.etag}:{}});
    if(response.status===304) {
      await env.DB.prepare('UPDATE sources SET status=?,last_checked=? WHERE id=?').bind('not-modified',new Date().toISOString(),source).run();
      return;
    }
    if(!response.ok)throw new Error('HTTP '+response.status);
    const result=normalize(await boundedText(response),'https://feed.invalid/rss');
    const now=new Date().toISOString();
    const statements=result.items.map(item=>env.DB.prepare(`INSERT INTO items(source,id,title,url,published_at,updated_at,first_seen) VALUES(?,?,?,?,?,?,?) ON CONFLICT(source,id) DO UPDATE SET title=excluded.title,url=excluded.url,published_at=excluded.published_at,updated_at=excluded.updated_at`).bind(source,item.id,item.title,item.url,item.publishedAt,item.updatedAt,now));
    statements.push(env.DB.prepare(`INSERT INTO sources(id,etag,status,last_checked) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET etag=excluded.etag,status=excluded.status,last_checked=excluded.last_checked`).bind(source,response.headers.get('etag'),'ok',now));
    await env.DB.batch(statements);
  } catch(error) {
    await env.DB.prepare(`INSERT INTO sources(id,status,last_checked) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,last_checked=excluded.last_checked`).bind(source,'error: '+error.message,new Date().toISOString()).run();
  }
}
export default { fetch:app.fetch, async scheduled(_event,env) { await collect(env); } };
