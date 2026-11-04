import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '*.md', base: '../articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    question: z.string(),
    topicId: z.string(),
    status: z.enum(['draft', 'published']),
    createdAt: z.string(),
    updatedAt: z.string(),
    verifiedAt: z.string(),
    verificationScope: z.string(),
    tags: z.array(z.string()),
    aliases: z.array(z.string()).default([]),
    simulator: z.string().optional(),
    talk: z.string().optional(),
  }),
});
const evidence = defineCollection({
  loader: glob({ pattern: '*.md', base: './.generated/records' }),
  schema: z.object({ title: z.string(), kind: z.string(), source: z.string() }),
});
export const collections = { articles, evidence };
