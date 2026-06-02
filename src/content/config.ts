import { defineCollection, z } from 'astro:content';

// 7 ступеней программы — каждая отдельным .md (контент строго в Markdown)
const steps = defineCollection({
  type: 'content',
  schema: z.object({
    order: z.number(),
    title: z.string(),
    system: z.string().optional(), // короткий тег системы организма
  }),
});

// Тарифы — каждый отдельным .md
const tariffs = defineCollection({
  type: 'content',
  schema: z.object({
    order: z.number(),
    name: z.string(),
    price: z.string(),
    badge: z.string().optional(),       // золотая пилюля «Популярный»
    limit: z.string().optional(),       // изумрудная строка «Только N мест»
    features: z.array(z.string()),
    cta: z.string().default('Забронировать место'),
  }),
});

// Синглтоны страницы (hero, audience, expert, cta) — поля опциональны, каждый файл берёт нужное
const page = defineCollection({
  type: 'content',
  schema: z.object({
    eyebrow: z.string().optional(),
    badge: z.string().optional(),
    titleMain: z.string().optional(),
    titleAccent: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    ctaPrimary: z.string().optional(),
    ctaSecondary: z.string().optional(),
    trust: z.array(z.string()).optional(),
    stats: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
    name: z.string().optional(),
    role: z.string().optional(),
    photo: z.string().optional(),
    photoPosition: z.string().optional(),
    credentials: z.array(z.string()).optional(),
    button: z.string().optional(),
    note: z.string().optional(),
  }),
});

export const collections = { steps, tariffs, page };
