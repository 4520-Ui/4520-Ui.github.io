import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(), slug: z.string(), summary: z.string(), date: z.coerce.date(),
    period: z.string().optional(), role: z.string(), status: z.string(),
    tags: z.array(z.string()).default([]), featured: z.boolean().default(false),
    order: z.number().default(0), cover: z.string(),
    links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(), slug: z.string(), summary: z.string(), date: z.coerce.date(),
    updated: z.coerce.date().optional(), tags: z.array(z.string()).default([]),
    kind: z.enum(['knowledge', 'journal']), publish: z.literal(true),
  }),
});
export const collections = { projects, notes };
