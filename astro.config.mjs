import { defineConfig } from 'astro/config';

// Статика. Деплой на Cloudflare Pages. Ассистент добавится как Cloudflare-функция позже.
export default defineConfig({
  site: 'https://molodost.pages.dev',
  server: { port: 4321, host: true },
});
