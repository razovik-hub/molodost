// Проверяет СОБРАННЫЙ пакет .fn-build/ так, как его выполнит Yandex Cloud Function:
// дёргает handler() напрямую фейковым HTTP-событием. Подтверждает, что снимок
// контекста подхватился и chat/tts/stt отвечают. Запуск: cd backend && node verify-function.mjs

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const mod = await import('./.fn-build/index.js'); // CommonJS-вход через interop
const handler = mod.handler || (mod.default && mod.default.handler);
const call = (body, method = 'POST') => handler({ httpMethod: method, body: body && JSON.stringify(body) });

let r = await call(null, 'OPTIONS');
console.log('OPTIONS →', r.statusCode, '(CORS preflight)');

r = await call({ action: 'chat', message: 'Коротко: что это за курс и сколько ступеней?' });
console.log('chat    →', r.statusCode, '|', JSON.parse(r.body).reply?.slice(0, 90), '…');

r = await call({ action: 'tts', text: 'Помогу выбрать тариф и записаться.' });
console.log('tts     →', r.statusCode, '| audio b64:', JSON.parse(r.body).audio?.length, 'симв.');

// STT-роут: проверяем что обработчик отвечает 400 на пустой аудио (т.е. путь живой).
// Реальный round-trip TTS→STT недоступен: v3 TTS отдаёт 22050 Hz, STT v1 принимает 16k/48k.
// В реальности микрофон браузера сам шлёт 16k PCM — это уже подтверждено через виджет.
r = await call({ action: 'stt', audio: '', rate: 16000 });
console.log('stt     →', r.statusCode, '|', JSON.parse(r.body).error || 'OK');
