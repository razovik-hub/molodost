// Прогоняет 5 типовых вопросов через ассистент и печатает ответы.
// Запуск: cd backend && node test.mjs

import { readFileSync } from 'node:fs';
import { ask } from './assistant.mjs';

// Подгружаем .env.local
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const cfg = {
  apiKey: process.env.YANDEX_API_KEY,
  folderId: process.env.YANDEX_FOLDER_ID,
  model: process.env.YANDEX_MODEL || 'yandexgpt-lite',
};

const cases = [
  'Расскажите коротко, что это за курс?',
  'Сколько стоит и какие есть варианты?',
  'Когда старт?',
  'У меня болят колени и плохо со сном. Подойдёт мне курс?',
  'Хочу личное ведение, как забронировать?',
];

console.log(`\n━━━ Тестовый прогон ассистента (модель: ${cfg.model}) ━━━\n`);

for (const q of cases) {
  const t0 = Date.now();
  try {
    const { text, usage } = await ask([{ role: 'user', text: q }], cfg);
    const ms = Date.now() - t0;
    console.log(`Q: ${q}`);
    console.log(`A: ${text}`);
    console.log(`   [${ms}ms, ${usage.totalTokens || '?'} tok, in/out: ${usage.inputTextTokens || '?'}/${usage.completionTokens || '?'}]\n`);
  } catch (e) {
    console.log(`Q: ${q}`);
    console.log(`ERROR: ${e.message}\n`);
  }
}
