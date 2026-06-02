// Локальный HTTP-сервер для разработки ассистента.
// Production-обёртка для Yandex Cloud Function — отдельный handler (index.mjs).

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { ask } from './assistant.mjs';

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
};

function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(obj));
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.url !== '/api/chat' || req.method !== 'POST') return json(res, 404, { error: 'not found' });

  let body = '';
  for await (const chunk of req) body += chunk;
  let payload;
  try { payload = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); }

  const history = Array.isArray(payload.history) ? payload.history : [];
  const message = String(payload.message || '').trim();
  if (!message && history.length === 0) return json(res, 400, { error: 'empty message' });

  const dialog = message ? [...history, { role: 'user', text: message }] : history;

  try {
    const t0 = Date.now();
    const { text, usage } = await ask(dialog, CFG);
    const ms = Date.now() - t0;
    console.log(`[chat] "${message.slice(0, 60)}" → ${ms}ms, ${usage.totalTokens || '?'} tok`);
    json(res, 200, { reply: text, usage });
  } catch (e) {
    console.error('[chat]', e.message);
    json(res, 500, { error: e.message });
  }
}).listen(PORT, () => {
  console.log(`✓ assistant dev-server on http://localhost:${PORT}/api/chat`);
  console.log(`  model: ${CFG.model}, folder: ${CFG.folderId}`);
});
