# Дебрянск Авто

Сайт автодилерской группы компаний «Дебрянск Авто» в Брянске — витрина бренда, каталог автомобилей, выкуп авто и страницы дилеров.

## Run & Operate

- `pnpm --filter @workspace/debryansk-avto run dev` — сайт (порт из $PORT)
- `pnpm --filter @workspace/api-server run dev` — API сервер (порт 8080)
- `pnpm --filter @workspace/admin-panel run dev` — панель администратора
- `pnpm run typecheck` — проверка типов по всем пакетам
- `pnpm run build` — typecheck + сборка всех пакетов
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, Framer Motion, shadcn/ui
- API: Express 5, esbuild (CJS bundle)
- DB: PostgreSQL + Drizzle ORM
- Icons: Lucide React, react-icons (si-иконки брендов)

## Where things live

- `artifacts/debryansk-avto/` — основной сайт (React + Vite)
  - `src/pages/home.tsx` — главная страница со своим хедером
  - `src/pages/buyout.tsx` — страница выкупа авто (двухшаговая форма)
  - `src/components/Layout.tsx` — общий лэйаут для всех страниц кроме главной
- `artifacts/api-server/` — бэкенд API
  - `src/routes/car-catalog.ts` — прайсы авто (Auto.ru API + fallback-таблица)
  - `src/routes/email.ts` — отправка email через nodemailer
- `artifacts/admin-panel/` — панель администратора

## Architecture decisions

- **Главная страница имеет собственный хедер** — `home.tsx` содержит встроенный `<header>` с анимацией логотипа (Framer Motion), не использует `Layout.tsx`. Изменения навигации нужно вносить в оба места.
- **Логотип в хедере анимируется при скролле** — ширина меняется с 140px (полный логотип) до 40px (иконка). Уменьшение нужно для того, чтобы все ссылки навигации помещались на экране 1024px.
- **Auto.ru price-stats API** — используется dealer-токен (`AUTORU_API_KEY`), который не имеет доступа к price-stats. Реализован fallback с базовыми ценами 40+ марок + формула амортизации (5%/год, 1%/10k км).
- **Email** через SMTP (`SMTP_PASS`). Маршрут `/api/send-email` — пути в роутере без префикса `/api` (он добавлен в `app.use`).
- **Object Storage** (Replit GCS) для загружаемых файлов из админки — бакет через `DEFAULT_OBJECT_STORAGE_BUCKET_ID`.

## Product

- Главная страница: hero с слайдером брендов, плитки быстрого доступа (Новые авто, С пробегом, Сервис, Выкуп авто), блок дилеров
- Страница выкупа `/buyout`: описание услуги, двухшаговая форма оценки (марка → пробег → расчёт цены)
- Каталог `/cars`: список автомобилей с фильтрами
- Страница сервиса `/service`, вакансии `/vacancies`, новости `/news`

## User preferences

- Тональность текстов — «Территория автомобилей», без маркетинговых клише
- Брендовый цвет: #0070b8 (синий), градиент `brand-gradient`
- Языки: интерфейс на русском

## Gotchas

- **Два хедера**: главная `/` использует встроенный хедер в `home.tsx`, остальные страницы — `Layout.tsx`. При добавлении навигационных ссылок нужно обновить оба файла.
- **Роутер Express**: пути в `router.get(...)` пишутся БЕЗ префикса `/api` — он добавлен через `app.use("/api", router)`.
- **multer и nodemailer** должны быть в списке `external` в конфиге esbuild, иначе бандл ломается.

## Pointers

- Репозиторий GitHub: `skodabryansk-collab/debryansk-avto`
- См. skill `auto-track-and-sync` для синхронизации изменений с GitHub
- См. skill `object-storage-debryansk` для работы с Object Storage
