// Локальный HTTP-сервер для разработки ассистента (чат + голос).
// Маршрутизация общая с production-функцией — см. router.mjs.
// Один эндпоинт: POST с JSON-телом, действие в поле `action` ('chat' | 'tts' | 'stt').

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { route } from './router.mjs';

// Подгружаем .env.local из корня проекта
function loadEnv() {
  try {
    const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv();

const PORT = Number(process.env.ASSISTANT_PORT || 8788);
const CFG = {
  apiKey: process.env.YANDEX_API_KEY,
  folderId: process.env.YANDEX_FOLDER_ID,
  model: process.env.YANDEX_MODEL || 'yandexgpt-lite',
  // SpeechKit v3 premium-голоса. marina/friendly — тёплый премиум; см. sample.html для альтернатив.
  voice: process.env.YANDEX_TTS_VOICE || 'marina',
  role: process.env.YANDEX_TTS_ROLE || process.env.YANDEX_TTS_EMOTION || 'friendly',
  speed: Number(process.env.YANDEX_TTS_SPEED) || 1.10,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
  res.end(JSON.stringify(obj));
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  // Сэмплер голоса: GET /sample — мини-страница, сравнить пресеты голоса/эмоции/темпа.
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/sample'))) {
    try {
      const html = readFileSync(new URL('./sample.html', import.meta.url));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch {
      return json(res, 404, { error: 'sample.html missing' });
    }
  }
  if (req.method !== 'POST') return json(res, 404, { error: 'not found' });

  let body = '';
  for await (const chunk of req) body += chunk;
  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    return json(res, 400, { error: 'bad json' });
  }

  const t0 = Date.now();
  try {
    const result = await route(payload, CFG);
    const tag = payload.action || 'chat';
    console.log(`[${tag}] → ${Date.now() - t0}ms`);
    json(res, 200, result);
  } catch (e) {
    console.error(`[${payload.action || 'chat'}]`, e.message);
    json(res, e.status || 500, { error: e.message });
  }
}).listen(PORT, () => {
  console.log(`✓ assistant dev-server on http://localhost:${PORT}`);
  console.log(`  model: ${CFG.model}, voice: ${CFG.voice}, folder: ${CFG.folderId}`);
});
