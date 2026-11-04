// Feasibility fixture only. Not imported by the blog or deployed anywhere.
import { XMLParser, XMLValidator } from 'fast-xml-parser';
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const text = value => typeof value === 'object' ? String(value?.['#text'] ?? '') : String(value ?? '');
const iso = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

export async function boundedText(response, limit = 4 * 1024 * 1024) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  let total = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new Error('Feed exceeds byte limit');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

export function normalize(xml, sourceUrl, limit = 500) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD is outside this probe scope');
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid XML');
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true,
    removeNSPrefix: true, processEntities: true,
    // Body is irrelevant to this title/link experiment.
    updateTag(tagName) { return ['description', 'content', 'encoded', 'summary'].includes(tagName) ? false : tagName; }
  }).parse(xml);
  const atom = !!parsed.feed;
  if (!atom && !parsed.rss?.channel) throw new Error('Unsupported feed root');
  const items = list(atom ? parsed.feed.entry : parsed.rss.channel.item);
  const unique = new Map();
  let rejected = 0;
  for (const item of items) {
    const link = atom ? list(item.link).find(x => !x['@_rel'] || x['@_rel'] === 'alternate')?.['@_href'] : text(item.link);
    let url;
    try { url = new URL(link || '', sourceUrl); } catch { rejected++; continue; }
    if (!link || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) { rejected++; continue; }
    const title = text(item.title).trim();
    if (!title) { rejected++; continue; }
    const id = text(atom ? item.id : item.guid) || url.href;
    unique.set(id, { id, title, url: url.href, publishedAt: iso(text(atom ? item.published : item.pubDate)), updatedAt: iso(text(item.updated)), });
    if (unique.size >= limit) break;
  }
  return { kind: atom ? 'atom' : 'rss', items: [...unique.values()], rejected, totalEntries: items.length };
}
