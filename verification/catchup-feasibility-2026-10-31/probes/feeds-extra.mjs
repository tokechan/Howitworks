import { writeFile } from 'node:fs/promises';
import { boundedText } from './feed-adapter.mjs';
const results = [];
for (const [id,url] of [['react-blog-feed','https://react.dev/rss.xml'],['vite-blog-feed','https://vite.dev/blog.rss']]) {
  const response = await fetch(url,{signal:AbortSignal.timeout(20000)});
  const xml = await boundedText(response,10*1024*1024);
  const result = { id,url,status:response.status,contentType:response.headers.get('content-type'),bytes:Buffer.byteLength(xml),checkedAt:new Date().toISOString() };
  if (!response.ok || !/<(?:rss|feed)\b/.test(xml)) throw new Error(JSON.stringify(result));
  await writeFile(`evidence/feeds/${id}.xml`,xml);
  results.push(result); console.log(result);
}
await writeFile('evidence/feeds-extra.json',JSON.stringify(results,null,2));
