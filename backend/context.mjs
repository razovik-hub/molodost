// Собирает «базу знаний» ассистента из Markdown-контента сайта.
// Ассистент читает ИМЕННО ТЕ же файлы, что отображаются на лендинге, —
// единый источник правды для сайта и для ИИ.

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_ROOT = join(__dirname, '..', 'src', 'content');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.name.endsWith('.md')) files.push(p);
  }
  return files;
}

/** Возвращает строку с полным контекстом курса для system-prompt. */
export async function buildCourseContext() {
  // В production-функции md-файлы не входят в пакет — рядом кладётся снимок
  // (course-context.txt), собранный при сборке. Локально такого файла нет →
  // читаем живой src/content (единый источник правды для сайта и ассистента).
  try {
    const snap = await readFile(join(__dirname, 'course-context.txt'), 'utf8');
    if (snap.trim()) return snap;
  } catch {}

  const files = await walk(CONTENT_ROOT);
  const sections = [];
  for (const f of files.sort()) {
    const rel = f.slice(CONTENT_ROOT.length + 1);
    const raw = await readFile(f, 'utf8');
    // Простое чтение: оставляем frontmatter (поля важны для модели: цены, лимиты)
    sections.push(`### ${rel}\n${raw.trim()}`);
  }
  return sections.join('\n\n---\n\n');
}
