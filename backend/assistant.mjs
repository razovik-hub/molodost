// Ядро ассистента: формирует system-prompt, вызывает YandexGPT, отдаёт текст.
// Используется и из локального dev-server'а, и из Cloud Function-обёртки.

import { buildCourseContext } from './context.mjs';

const YGPT_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

const SYSTEM_PROMPT_TEMPLATE = `
Ты — ассистент курса «Алхимия молодости: 7 ступеней» Марины Робертовны Баяндиной (антивозрастная нутрициология для женщин premium-сегмента).

ТВОИ ЗАДАЧИ:
- Отвечать по фактам ниже. Что не знаешь — честно «уточню у Марины» + предложить оставить контакт.
- Помогать выбрать тариф.
- Когда человек готов — предложить забронировать место, спросить имя и контакт (Telegram-юзернейм или телефон).
- Не давать медицинских советов и диагнозов. Если спрашивают про здоровье — это к Марине на курсе или консультации.

ТОН — критически важно:
- Живой русский, как умный человек собеседнику. Premium = сдержанно и уверенно, НЕ казённо.
- Короткими репликами. 2–4 предложения обычно достаточно. Длинно — только если человек явно просит подробно.
- Никогда не начинай с «Здравствуйте!» — собеседник уже в диалоге, это не первое сообщение.
- Не заканчивай словами «Спасибо за интерес!», «До встречи!», «Удачи!», «Будем рады видеть!». Не лебези.
- Без капса, без эмодзи, без «успейте/спешите/не упустите/осталось мало мест».
- Не используй markdown — никаких **звёздочек**, # заголовков, нумерованных списков с жирным. Только обычный текст. Если нужен список — короткие тире.
- Не повторяй каждый раз полное название курса. «Курс», «наш курс», «программа» — этого достаточно.

ПО ДАТАМ: точных дат старта ещё нет. Если спрашивают — «даты уточняем, могу записать вас в лист ожидания и сообщить как только определимся».

═══ ФАКТЫ О КУРСЕ ═══

{CONTEXT}

═══ КОНЕЦ ═══
`.trim();

let cachedSystemPrompt = null;

async function getSystemPrompt() {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const ctx = await buildCourseContext();
  cachedSystemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{CONTEXT}', ctx);
  return cachedSystemPrompt;
}

/**
 * @param {Array<{role:'user'|'assistant', text:string}>} history — история диалога
 * @param {{apiKey:string, folderId:string, model?:string}} cfg
 * @returns {Promise<{text:string, usage:object}>}
 */
export async function ask(history, cfg) {
  if (!cfg.apiKey) throw new Error('YANDEX_API_KEY не задан');
  if (!cfg.folderId) throw new Error('YANDEX_FOLDER_ID не задан');

  const system = await getSystemPrompt();
  const model = cfg.model || 'yandexgpt'; // Pro: лучше слушается тон. Lite дешевле, но казённее.

  const body = {
    modelUri: `gpt://${cfg.folderId}/${model}/latest`,
    completionOptions: { stream: false, temperature: 0.4, maxTokens: '600' },
    messages: [{ role: 'system', text: system }, ...history],
  };

  const res = await fetch(YGPT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Api-Key ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YandexGPT HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data?.result?.alternatives?.[0]?.message?.text ?? '';
  return { text: cleanReply(raw), usage: data?.result?.usage ?? {} };
}

/**
 * Подчищает ответ модели: убирает markdown-разметку и казённые формулы,
 * которые модель иногда вставляет, несмотря на запрет в system-prompt.
 * Чат-виджет рендерит plain text — markdown показался бы сырыми звёздочками.
 */
export function cleanReply(s) {
  if (!s) return s;
  return s
    // ** bold ** и __ bold __ → текст
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // одиночные * и _ для курсива → убираем
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1$2')
    // # заголовки → текст
    .replace(/^#{1,6}\s+/gm, '')
    // нумерованные списки «1. ... 2. ...» → «— ...»
    .replace(/^\s*\d+\.\s+/gm, '— ')
    // казённые приветствия в начале (мы уже в диалоге)
    .replace(/^(Здравствуйте|Добрый день|Приветствую)[!,.]?\s*/i, '')
    // лебезящие хвосты
    .replace(/\s*(Спасибо за интерес[!.]?|Будем рады видеть вас!?|Удачи!?|До встречи!?|С уважением.*)\s*$/i, '')
    .trim();
}
