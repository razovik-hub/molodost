// Единая маршрутизация запросов ассистента — ОДНА точка для dev-server и Cloud Function.
// Один эндпоинт, JSON in/out, действие в поле `action`. Аудио передаётся в base64
// (и на вход STT, и на выход TTS) — чтобы и локально, и в облаке работать только с JSON.

import { ask } from './assistant.mjs';
import { synthesize, recognize } from './speech.mjs';

const err = (status, msg) => Object.assign(new Error(msg), { status });

/**
 * @param {object} payload — { action: 'chat'|'tts'|'stt', ... }
 * @param {{apiKey:string, folderId:string, model?:string, voice?:string}} cfg
 * @returns {Promise<object>} тело JSON-ответа
 */
export async function route(payload, cfg) {
  const action = payload.action || 'chat'; // back-compat: старый виджет шлёт {history,message} без action

  if (action === 'chat') {
    const history = Array.isArray(payload.history) ? payload.history : [];
    const message = String(payload.message || '').trim();
    if (!message && history.length === 0) throw err(400, 'empty message');
    const dialog = message ? [...history, { role: 'user', text: message }] : history;
    const { text, usage } = await ask(dialog, cfg);
    return { reply: text, usage };
  }

  if (action === 'tts') {
    const text = String(payload.text || '').trim();
    if (!text) throw err(400, 'empty text');
    // Параметры голоса можно переопределить per-call (sampler шлёт voice/role/speed).
    // `emotion` — legacy-имя v1, маппится в `role` v3.
    const opts = { ...cfg };
    if (payload.voice) opts.voice = String(payload.voice);
    if (payload.role) opts.role = String(payload.role);
    if (payload.emotion) opts.role = String(payload.emotion);
    if (payload.speed != null) opts.speed = Number(payload.speed);
    const wav = await synthesize(text, opts);
    return { audio: wav.toString('base64'), mime: 'audio/wav' };
  }

  if (action === 'stt') {
    const audio = Buffer.from(String(payload.audio || ''), 'base64');
    if (!audio.length) throw err(400, 'empty audio');
    const text = await recognize(audio, { ...cfg, sampleRateHertz: Number(payload.rate) || undefined });
    return { text };
  }

  throw err(400, `unknown action: ${action}`);
}
