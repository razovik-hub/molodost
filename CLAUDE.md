# Алхимия молодости: 7 ступеней

Проект Сергея Васильева для Марины Баяндиной — премиум-курс по антивозрастной нутрициологии. Полный бриф и факты — в [`CONTEXT.md`](./CONTEXT.md) и в `memory/` (user-sergey, molodost, project-playbook).

## Состояние

- **Сайт:** [https://razovik-hub.github.io/molodost/](https://razovik-hub.github.io/molodost/) — GitHub Pages, авто-деплой на push в `main` (workflow `.github/workflows/deploy.yml`).
- **Репо:** [github.com/razovik-hub/molodost](https://github.com/razovik-hub/molodost) (public, ветка `main`).
- **Ассистент:** текстовый этап готов, работает **только локально** (запуск из `backend/` на :8788). Голос и production-деплой бэкенда — впереди.

## Стек

- **Astro 4.16** → статика. Контент строго в Markdown — `src/content/page/*.md`, `src/content/steps/*.md`, `src/content/tariffs/*.md`. **Не зашивать тексты в `.astro`/CSS.**
- **YandexGPT** (модель `yandexgpt` Pro) + Yandex SpeechKit (ещё не подключён). Yandex Cloud аккаунт у Сергея: cloud `cloud-bezpiero` (`b1gv9mqqv2lm6dnikl5k`), folder `b1gskca1ipbfi2sn245m`.
- Секреты — в `~/Documents/Molodost/.env.local` (gitignored, **не читать без явной просьбы**).

## Стиль (premium)

- Палитра: айвори/шампань (фон), графитово-баклажановый (текст), **золото** (главный акцент), **изумруд** (второй), пудра-роза.
- Шрифты: **Cormorant** (заголовки, сериф) + **Manrope** (текст, гротеск).
- Облагороженный neo-brutalism: тонкие линии, мягкие тени, золотые волосяные разделители, много воздуха.

## Тон копи

Живой русский, **без канцелярита** (Сергей чувствителен к сухости). «Системная программа о том, как…» — нельзя. Premium ≠ казённо. У ассистента в `backend/assistant.mjs` есть `cleanReply()` — она strip-ит markdown и казённые «Здравствуйте/Спасибо за интерес», которые YandexGPT иногда вставляет.

## Фото Марины

Только с **bayandina.ru** (на Tilda, изображения на `static.tildacdn.com` — доставать через `curl + grep`, не WebFetch). НЕ из каталогов врачей (meds.ru / Grand Clinic / WomenFirst).

## Запуск локально

```bash
# терминал 1 — backend ассистента
cd backend && node dev-server.mjs           # :8788

# терминал 2 — сайт
npm run dev                                  # :4321
```

Деплой production происходит автоматически: `git push origin main` → GH Pages пересобирается за ~1 минуту.

## Открытые задачи

- 🔊 Голос: подключить Yandex SpeechKit STT + TTS (стартовый голос — `alena`)
- 📨 Бронь: Telegram-бот для уведомлений (env-плейсхолдеры `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` уже в `.env.local.example`)
- ☁️ Деплой бэкенда: Yandex Cloud Function (HTTP-trigger), потом обновить `PUBLIC_ASSISTANT_API` для production
- 💳 Платёжка: выбрать YooKassa / Prodamus / др., потом добавить генерацию ссылки на оплату
- 📅 Даты и формат курса: не известны
- 📦 Публикации (`stories.html`, `create-slides.js`) из старого проекта Pohudan — для этого продукта ещё не делали

## История

Это **второй** проект с Мариной. Первый — «Победи холодильник» (курс снижения веса), репо `razovik-hub/pohudan`, отдельный комикс/поп-арт стиль, GitHub Pages. Из него взят плейбук, но визуальный язык совсем другой (тот — комикс, этот — premium).
