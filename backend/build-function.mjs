// Сборка самодостаточного пакета для Yandex Cloud Function.
// Кладёт модули ассистента + снимок контента курса в backend/.fn-build/.
// Затем папку архивируют (см. вывод) и зип загружают в консоль Yandex Cloud.
//
// Запуск: cd backend && node build-function.mjs

import { mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCourseContext } from './context.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '.fn-build');

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// Модули функции (вход index.js — CommonJS; остальные — ESM .mjs, в одной папке)
const MODULES = ['index.js', 'router.mjs', 'assistant.mjs', 'speech.mjs', 'context.mjs'];
for (const f of MODULES) await copyFile(join(__dirname, f), join(OUT, f));

// Снимок контекста курса — собран из живых src/content/*.md
const ctx = await buildCourseContext();
await writeFile(join(OUT, 'course-context.txt'), ctx, 'utf8');

// Минимальный package.json (без зависимостей; fetch встроен в Node 18+).
// Без "type":"module" — index.js трактуется как CommonJS, .mjs остаются ESM по расширению.
await writeFile(
  join(OUT, 'package.json'),
  JSON.stringify({ name: 'molodost-assistant-fn', version: '1.0.0', main: 'index.js' }, null, 2) + '\n',
  'utf8',
);

console.log(`✓ Пакет собран: ${OUT}`);
console.log(`  модулей: ${MODULES.length}, снимок контекста: ${ctx.length} символов`);
console.log(`  дальше: cd "${OUT}" && zip -r ../assistant-function.zip .`);
