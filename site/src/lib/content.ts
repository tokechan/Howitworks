import { getCollection } from 'astro:content';
import { includeDrafts } from '../../scripts/config.mjs';

export async function articles() {
  return (await getCollection('articles', ({ data }) => includeDrafts || data.status === 'published'))
    .sort((a, b) => b.data.updatedAt.localeCompare(a.data.updatedAt));
}
export const topics = [
  { id: 'nodejs', label: 'Node.js', description: 'ランタイムの中で何が起きているのか。' },
  { id: 'http', label: 'HTTP', description: '通信と、その先にある処理の仕組み。' },
  { id: 'compression', label: '圧縮', description: 'データを小さくして、元に戻すまで。' },
  { id: 'security', label: 'セキュリティ', description: '不具合の原因と、修正が届く道のり。' },
];
export function topicSlug(label: string) { return topics.find(t => t.label === label)?.id || encodeURIComponent(label); }
export const date = (value: string) => value.replaceAll('-', '.');
