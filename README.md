# WikiNova

Локальная энциклопедия с продвинутой админ-панелью и встроенным AI-ассистентом (работает с любым OpenAI-совместимым endpoint: LM Studio, Ollama, vLLM, OpenAI).

## Запуск

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Сайт: http://localhost:3000

Прод-сборка: `npm run build && npm start`.

> Если порт 3000 занят другим приложением: `PORT=3001 npm start` (Windows PowerShell: `$env:PORT=3001; npm start`). Не запускайте `npm run dev` и `npm start` одновременно: они делят каталог `.next`.

## Доступ

| Роль | Email | Пароль |
|---|---|---|
| Администратор | admin@wikinova.local | admin123 |
| Редактор | editor@wikinova.local | editor123 |
| Читатель | anna@wikinova.local | user12345 |

Вход: `/admin/login`. Панель: `/admin`.

## AI-ассистент

Настройки: `/admin/ai/settings`. Значения из БД перекрывают `.env`.

```env
AI_BASE_URL=http://host.docker.internal:1234/v1   # LM Studio и т.п.
AI_API_KEY=                                        # для OpenAI
AI_MODEL=google/gemma-4-12b-qat
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2048
AI_TIMEOUT_MS=60000
```

Кнопка «Протестировать подключение» в настройках показывает `OK · модель ответила за Nms · tokens: in/out` либо честную ошибку. API-ключ хранится в БД зашифрованным (AES-256-GCM, ключ из `ENCRYPTION_KEY`), в интерфейсе видна только маска.

Клавиши: `Cmd/Ctrl+J` — открыть/закрыть ассистента, `Esc` — закрыть.

## Структура

- `app/(public)` — публичные страницы (главная, каталог, статья, категории, теги, поиск, заявки)
- `app/admin` — админ-панель (статьи с Tiptap-редактором, медиа, заявки, пользователи, теги, категории, настройки, AI-раздел)
- `app/api` — REST-роуты (публичные, админские, AI со стримингом SSE)
- `components/{article,admin,ai,ui}` — компоненты
- `lib/{ai,db,auth,crypto,utils}` — серверная логика
- `prisma` — схема и seed (SQLite `prisma/dev.db`)
- `DESIGN.md` — дизайн-конституция, `ANTI-SLOP-AUDIT.md` — аудит

## Полезные команды

```bash
npm run db:push    # применить схему
npm run db:seed    # наполнить демо-данными (идемпотентно по slug)
npm run db:studio  # Prisma Studio
npx tsc --noEmit   # типы
```
