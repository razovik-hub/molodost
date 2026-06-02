import { defineConfig } from 'astro/config';

// Поддерживаем два таргета:
//  - Cloudflare Pages (по умолчанию): site=pages.dev, base=/
//  - GitHub Pages (env DEPLOY=ghpages): site=razovik-hub.github.io, base=/molodost
// Контент строго в Markdown, ассистент добавится как функция позже.
const isGhPages = process.env.DEPLOY === 'ghpages';

export default defineConfig({
  site: isGhPages ? 'https://razovik-hub.github.io' : 'https://molodost.pages.dev',
  base: isGhPages ? '/molodost' : '/',
  server: { port: 4321, host: true },
});
