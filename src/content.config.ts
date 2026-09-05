import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { categoryIds } from './data/categories';
import { topicIds } from './data/topics';

const concepts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/concepts' }),
  schema: z.object({
    id: z.string(), name: z.string(), subtitle: z.string(), country: z.string(),
    category: z.enum(categoryIds), source: z.string(),
    definition: z.object({ source: z.string(), effectiveFrom: z.string().optional(), asOf: z.string().optional() }).optional(),
    updatedAt: z.coerce.date(), related: z.array(z.string()), chart: z.string().optional(), graph: z.string().optional(), order: z.number(),
    level: z.enum(['basic', 'advanced']).default('basic'), topics: z.array(z.enum(topicIds)).default([]),
    prerequisites: z.array(z.string()).default([]), featured: z.boolean().default(false)
  })
});

export const collections = { concepts };
