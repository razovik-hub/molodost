// Yandex SpeechKit (REST): синтез v3 (premium) + распознавание v1 (стабильный sync).
// Используется и локальным dev-server'ом, и Cloud Function-обёрткой (через router.mjs).
//
// Почему такие форматы:
//  - TTS v3 (utteranceSynthesis) — премиум-голоса (marina/whisper и др.) и роли,
//    которых нет в v1. Отдаём WAV-контейнер: играется везде, включая Safari/iOS.
//  - STT v1 — синхронный, простой, надёжный для коротких реплик (≤30 c).
//    Принимает сырой PCM16 mono с фронта (браузер делает downsample до 16k),
//    чтобы не таскать ffmpeg для перекодирования webm/opus.

const TTS_V3_URL = 'https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis';
const STT_URL = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize';

const STT_SAMPLE_RATE = 16000; // частота, в которой браузер шлёт голос пользователя

// Карта валидных ролей по голосам (проверено эмпирически на актуальной v3).
// Если запрошенная роль не поддерживается голосом — мы пропускаем поле role
// (SpeechKit берёт дефолтную для этого голоса), а не падаем с 400.
const VOICE_ROLES = {
  marina: ['neutral', 'friendly', 'whisper'],
  alena: ['neutral', 'good'],
  jane: ['neutral', 'good', 'evil'],
  omazh: ['neutral', 'evil'],
  lera: ['neutral', 'friendly'],
  masha: ['neutral', 'good', 'friendly', 'strict'],
  dasha: ['neutral', 'good', 'friendly'],
  julia: ['neutral', 'strict'],
};

/**
 * Синтез речи v3. Возвращает WAV-буфер — готов к воспроизведению.
 * @param {string} text — обычный текст или SSML (если начинается с <speak>)
 * @param {{apiKey:string, voice?:string, role?:string, emotion?:string, speed?:number}} cfg
 *        emotion — legacy-имя для role (v1-совместимость).
 * @returns {Promise<Buffer>} audio/wav
 */
export async function synthesize(text, cfg) {
  if (!cfg.apiKey) throw new Error('YANDEX_API_KEY не задан');
  const clean = String(text || '').trim().slice(0, 4900); // лимит SpeechKit — 5000 символов
  if (!clean) throw new Error('пустой текст для синтеза');

  const voice = cfg.voice || 'marina';
  const role = cfg.role || cfg.emotion; // emotion из v1 → role в v3
  const speed = Number(cfg.speed) || 1.0;

  const hints = [{ voice }];
  if (role && VOICE_ROLES[voice]?.includes(role)) hints.push({ role });
  if (speed && Math.abs(speed - 1.0) > 0.001) hints.push({ speed });

  const body = {
    text: clean,
    hints,
    outputAudioSpec: { containerAudio: { containerAudioType: 'WAV' } },
    loudnessNormalizationType: 'LUFS', // мягкая нормализация громкости
  };

  const res = await fetch(TTS_V3_URL, {
    method: 'POST',
    headers: { Authorization: `Api-Key ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`SpeechKit v3 HTTP ${res.status}: ${await res.text()}`);
  }

  // Ответ — стрим NDJSON: каждая строка `{"result":{"audioChunk":{"data":"base64..."},...}}`.
  // Собираем все аудиочанки и склеиваем. На коротком тексте обычно один чанк.
  const chunks = [];
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const flushLine = (line) => {
    line = line.trim();
    if (!line) return;
    try {
      const obj = JSON.parse(line);
      const data = obj?.result?.audioChunk?.data;
      if (data) chunks.push(Buffer.from(data, 'base64'));
    } catch { /* пропускаем мусорные строки */ }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      flushLine(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  if (buf) flushLine(buf);

  if (chunks.length === 0) throw new Error('SpeechKit v3 вернул пустой стрим');
  if (chunks.length === 1) return chunks[0]; // одна строка — уже целый WAV
  return concatWav(chunks); // несколько WAV-чанков → один WAV
}

/** Список доступных пресетов (для сэмплера и валидации фронта). */
export const VOICE_ROLE_MAP = VOICE_ROLES;

/**
 * Распознавание короткого аудио (синхронный режим: ≤30 сек, ≤1 МБ).
 * @param {Buffer} audio — сырой LPCM, signed 16-bit LE, моно
 * @param {{apiKey:string, folderId:string, sampleRateHertz?:number}} cfg
 * @returns {Promise<string>} распознанный текст
 */
export async function recognize(audio, cfg) {
  if (!cfg.apiKey) throw new Error('YANDEX_API_KEY не задан');
  if (!cfg.folderId) throw new Error('YANDEX_FOLDER_ID не задан');
  if (!audio || audio.length === 0) throw new Error('пустое аудио');

  const params = new URLSearchParams({
    lang: 'ru-RU',
    topic: 'general',
    format: 'lpcm',
    sampleRateHertz: String(cfg.sampleRateHertz || STT_SAMPLE_RATE),
    folderId: cfg.folderId,
  });

  const res = await fetch(`${STT_URL}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Api-Key ${cfg.apiKey}`,
      'Content-Type': 'application/octet-stream',
    },
    body: audio,
  });

  if (!res.ok) {
    throw new Error(`SpeechKit STT HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (data.error_code) throw new Error(`SpeechKit STT: ${data.error_code} ${data.error_message || ''}`);
  return (data.result || '').trim();
}

/** Склеивает несколько WAV-чанков в один WAV (берёт первый заголовок, пересчитывает размеры). */
function concatWav(chunks) {
  const HEAD = 44; // классический PCM16-mono WAV-заголовок
  const pcmParts = chunks.map((c) => c.subarray(HEAD));
  const pcm = Buffer.concat(pcmParts);
  const header = Buffer.from(chunks[0].subarray(0, HEAD));
  header.writeUInt32LE(36 + pcm.length, 4);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
