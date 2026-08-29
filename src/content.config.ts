import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const concepts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/concepts' }),
  schema: z.object({
    id: z.string(), name: z.string(), subtitle: z.string(), country: z.string(),
    category: z.string(), source: z.string(),
    definition: z.object({ source: z.string(), effectiveFrom: z.string().optional(), asOf: z.string().optional() }).optional(),
    updatedAt: z.coerce.date(), related: z.array(z.string()), chart: z.string().optional(), graph: z.string().optional(), order: z.number()
  })
});

export const collections = { concepts };
