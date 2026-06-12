// Yandex Cloud Function — production-обёртка ассистента (чат + голос).
// Точка входа: index.handler. Вход на CommonJS (универсально поддерживается
// рантаймом Node на Yandex CF); ESM-логика (router.mjs) подгружается через import().

const CFG = {
  apiKey: process.env.YANDEX_API_KEY,
  folderId: process.env.YANDEX_FOLDER_ID,
  model: process.env.YANDEX_MODEL || 'yandexgpt', // в проде — Pro: лучше держит тон
  // SpeechKit v3 premium-голоса (см. backend/speech.mjs VOICE_ROLES для альтернатив).
  voice: process.env.YANDEX_TTS_VOICE || 'marina',
  role: process.env.YANDEX_TTS_ROLE || process.env.YANDEX_TTS_EMOTION || 'friendly',
  speed: Number(process.env.YANDEX_TTS_SPEED) || 1.10,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  body: JSON.stringify(obj),
});

// router.mjs — ESM; кэшируем динамический импорт между вызовами (тёплый старт)
let _route;
async function getRoute() {
  if (!_route) ({ route: _route } = await import('./router.mjs'));
  return _route;
}

module.exports.handler = async (event = {}) => {
  const method = event.httpMethod || (event.requestContext && event.requestContext.httpMethod);
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (method && method !== 'POST') return reply(404, { error: 'not found' });

  let raw = event.body || '{}';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'bad json' });
  }

  try {
    const route = await getRoute();
    return reply(200, await route(payload, CFG));
  } catch (e) {
    console.error('[assistant]', e.message);
    return reply(e.status || 500, { error: e.message });
  }
};
