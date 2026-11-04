import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { articleId, projectRoot } from '../../config/site.ts';

const date = z.iso.date();
export const articleSchema = z.object({
  title: z.string().min(1), description: z.string().min(1), question: z.string().min(1),
  topicId: z.string().min(1), status: z.enum(['draft', 'published']),
  createdAt: date, updatedAt: date, verifiedAt: date, verificationScope: z.string(),
  tags: z.array(z.string()), aliases: z.array(z.string()).default([]),
  simulator: z.string().optional(), talk: z.string().optional(),
});

export function parseArticle(source: string) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('Article frontmatter is missing.');
  return { id: articleId, data: articleSchema.parse(parse(match[1])), body: match[2] };
}

export async function loadArticle() {
  return parseArticle(await readFile(path.join(projectRoot, `articles/${articleId}.md`), 'utf8'));
}

export function isVisible(article: Article, includeDrafts: boolean) {
  return article.data.status === 'published' || includeDrafts;
}

export type Article = ReturnType<typeof parseArticle>;
