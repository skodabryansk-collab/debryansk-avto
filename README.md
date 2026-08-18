# Дебрянск Авто

<p align="center">
  <strong>Мультибрендовый автомобильный дилерский портал</strong><br>
  <em>Официальный сайт: <a href="https://debryansk-auto.ru">debryansk-auto.ru</a></em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/TailwindCSS-4-38B2AC?logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/TypeScript-5.9+-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express" alt="Express">
  <img src="https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/pnpm-monorepo-F69220?logo=pnpm" alt="pnpm">
</p>

---

## Содержание

- [О проекте](#о-проекте)
- [Технологический стек](#технологический-стек)
- [Архитектура монорепозитория](#архитектура-монорепозитория)
- [Публичный сайт](#публичный-сайт)
- [Бренд-страницы](#бренд-страницы)
- [AI Навигатор](#ai-навигатор)
- [Каталог автомобилей](#каталог-автомобилей)
- [Сервисные страницы](#сервисные-страницы)
- [Административная панель](#административная-панель)
- [Портал менеджеров](#портал-менеджеров)
- [API-сервер](#api-сервер)
- [SEO-центр](#seo-центр)
- [Внешние интеграции](#внешние-интеграции)
- [Медиа и хранилище](#медиа-и-хранилище)
- [Email и уведомления](#email-и-уведомления)
- [Производство (VPS)](#производство-vps)
- [Разработка](#разработка)
- [Переменные окружения](#переменные-окружения)

---

## О проекте

**Дебрянск Авто** — полнофункциональный веб-портал мультибрендовой дилерской группы (г. Брянск, группа компаний 9 БР). Включает:

- **Публичный сайт** для покупателей с каталогами новых и б/у авто, AI-ассистентом, SEO-оптимизацией
- **Административную панель** для управления контентом, лидами, SEO, аналитикой
- **REST API-сервер** с prerender-кэшем, SSG, интеграциями и SEO-движком

### Представленные бренды

| Новые автомобили | |
|---|---|
| OMODA / JAECOO | Супонево |
| Haval City | Литейная |
| Haval Pro | Московский |
| JETOUR | Московский |
| Tenet / Tenet Plus | Советская |
| EXEED / Jeland | Супонево |
| Mercedes-Benz | Московский |
| Volkswagen / SKODA | Советская / Супонево |
| SOUEAST | Московский |

**Автомобили с пробегом**: все марки (Skoda, BMW, Audi, Toyota, Hyundai и др.)

---

## Технологический стек

### Frontend — `artifacts/debryansk-avto`

| Технология | Назначение |
|---|---|
| **React 19** | UI-фреймворк |
| **Vite 7** | Сборка и dev-сервер |
| **TypeScript 5.9** | Строгая типизация |
| **Tailwind CSS 4** | Utility-first стилизация |
| **wouter** | Лёгкий SPA-роутинг (1.5 KB) |
| **@tanstack/react-query** | Серверное состояние, кэширование |
| **react-helmet-async** | Динамические SEO meta-теги |
| **framer-motion** | Анимации и переходы |
| **Яндекс Карты JS API 3.0** | Интерактивные карты локаций |
| **shadcn/ui + Radix UI** | 50+ UI-компонентов |
| **lucide-react** | Иконки |
| **recharts** | Графики (в дашборде) |

### Admin Panel — `artifacts/admin-panel`

| Технология | Назначение |
|---|---|
| **React 19** | UI-фреймворк |
| **Vite 7** | Сборка |
| **TanStack Query** | Загрузка и мутации данных |
| **shadcn/ui** | DataTable, Form, Dialog, Tabs |
| **recharts** | Аналитические графики |
| **@codemirror** | Markdown-редактор новостей |

### Backend — `artifacts/api-server`

| Технология | Назначение |
|---|---|
| **Express 5** | Веб-фреймворк |
| **TypeScript** | Строгая типизация |
| **Drizzle ORM** | Типобезопасные SQL-запросы |
| **PostgreSQL** | Реляционное хранилище |
| **Puppeteer + Chrome** | Prerender SSR и генерация OG-изображений |
| **Sharp** | Обработка изображений |
| **Pino** | Структурированное логирование |
| **JWT + bcrypt** | Аутентификация |
| **Nodemailer** | SMTP-отправка писем |
| **esbuild** | Бандлинг для продакшна |

---

## Архитектура монорепозитория

```
workspace/
├── artifacts/
│   ├── debryansk-avto/          # Публичный сайт (React + Vite)
│   ├── admin-panel/             # Административная панель (React + Vite)
│   ├── api-server/              # REST API (Express + Drizzle + PostgreSQL)
│   ├── mockup-sandbox/          # Песочница UI-компонентов (для Replit Canvas)
│   └── debryansk-presentation/  # Слайды для презентаций
├── lib/
│   ├── db/                      # Drizzle-схема и миграции (единая БД)
│   ├── api-spec/                # Типы API-контракта
│   ├── api-client-react/        # React Query-хуки (клиент)
│   ├── api-zod/                 # Zod-схемы валидации
│   ├── integrations-openai-ai-server/   # Серверный OpenAI (audio/image/batch)
│   └── integrations-openai-ai-react/    # React-хуки для голосового ввода
├── scripts/
│   ├── deploy-vps.sh            # Деплой на Timeweb VPS
│   ├── build-frontend.sh        # Сборка фронтенда
│   ├── post-merge.sh            # Скрипт после merge задач
│   └── vps-offsite-backup.sh    # Резервное копирование БД
└── package.json                 # Корневой pnpm workspace
```

### Маршрутизация на продакшне

```
Пользователь → Nginx (5.42.110.134) → Express API (localhost:8080)
                                            ├── /          → SSG + Prerender-cache → React SPA
                                            ├── /api/*     → REST handlers
                                            └── /admin/*   → Статика admin-panel
```

---

## Публичный сайт

### Страницы (`/`)

| Маршрут | Страница | Описание |
|---|---|---|
| `/` | Главная | Хиро, бренды, новые авто, б/у, отзывы, AI Навигатор |
| `/new-cars` | Каталог новых авто | Фильтры, сортировка, карточки с ценами и скидками |
| `/new-cars/:id` | Карточка нового авто | Фото, комплектации, форма заявки, локация |
| `/cars` | Каталог б/у авто | Фильтры по марке/модели/цене/пробегу, популярность |
| `/cars/:id` | Карточка б/у авто | Фото, характеристики, история, форма заявки |
| `/brands/:slug` | Бренд-страница | Модели, цены, акции, карта, локация, JSON-LD |
| `/service` | Сервис | Виды ТО, запись на сервис |
| `/service/bonus` | Бонусная программа | Условия программы лояльности |
| `/buyout` | Выкуп и комиссия | Оценка авто, формы заявки, локации |
| `/corporate` | Для бизнеса | Корпоративное обслуживание |
| `/about` | О компании | История, команда, локации |
| `/contacts` | Контакты | Карта всех локаций, режим работы |
| `/news` | Новости | Сетка статей с SSG-инжекцией |
| `/news/:slug` | Статья | Полный текст, OG-изображение, schema.org |
| `/promotions/:slug` | Акция | Детальная страница акции |
| `/vacancies` | Вакансии | Синхронизация с hh.ru |
| `/compare` | Сравнение авто | Сравнение до N автомобилей |
| `/favorites` | Избранное | Сохранённые авто (localStorage) |
| `/p/:slug` | Лендинги | CMS-лендинги из БД (slug-маршрутизация) |
| `/corporate` | Для бизнеса | Корпоративное ТО и обслуживание парка |
| `/privacy` | Политика конфиденциальности | Юридический текст |
| `/legal` | Правовая информация | Юридический текст |

### Ключевые UX-функции

- **Фильтрация каталога** — по марке, модели, году, цвету, пробегу, цене, типу КПП/привода с URL-синхронизацией
- **Популярность б/у авто** — инкремент просмотров через `POST /api/cars/views/used/:id`, сортировка по `popularity_score`
- **Избранное и сравнение** — localStorage, счётчики в шапке
- **Локационный телефон в шапке** — на странице `/buyout` показывается номер Супонево, на бренд-страницах — номер привязанной локации из БД
- **AI Навигатор** — встроен в главную страницу через `ChatWidget`
- **Calltouch** — виджет коллтрекинга подключён через внешний скрипт
- **Яндекс.Метрика** — счётчик + цели на формах

---

## Бренд-страницы

Маршрут: `/brands/:slug`

Каждая бренд-страница содержит:
- **Модели с ценами** — из CMS + автофид (CM Expert), с минимальной ценой и скидками
- **Акции** — активные промо из таблицы `promotions`
- **Галерея** — фото дилерского центра
- **Локация** — карта Яндекс, адрес, часы работы, телефон локации из БД
- **Сервис** — записная форма на ТО
- **SEO** — уникальный `<title>`, `<meta description>`, `<canonical>`, JSON-LD `AutoDealer`, `ItemList` моделей
- **OG-изображение** — генерируется через Puppeteer (1200×630 PNG, кэш 7 дней на диске)
- **Prerender** — HTML-кэш в GCS, обновляется при изменении авто или по расписанию

Управление брендами — в админке `/brands`.

---

## AI Навигатор

Маршрут: `POST /api/chat`, `POST /api/chat/stream`, `POST /api/chat/rate`

AI-ассистент для подбора автомобиля:

- **Модель**: gpt-5-mini через Timeweb AI Gateway
- **Режим**: streaming (SSE) + fallback обычный JSON
- **Контекст**: в системный промпт инжектируется каталог (50 б/у + 60 новых авто) с ценами, скидками, комплектациями, пробегом
- **Ответ**: `{ reply, car_ids[], action }` — Навигатор может предложить конкретные автомобили
- **Рейтинг**: POST `/api/chat/rate` — оценка ответа (thumbs up/down)
- **История**: сообщения хранятся в `localStorage` (ключ `nav_messages_<session_id>`, до 60 сообщений)
- **UI**: `ChatWidget` встроен в главную страницу без Layout

Администрирование — `/navigator` в админке (просмотр диалогов, управление quick-ответами).

---

## Каталог автомобилей

### Новые авто

- Синхронизация через CM Expert API (фид)
- Таблица `cars` (type=`new`), поля: марка, модель, год, цена, скидки (max_discount, credit_discount, tradein_discount), дилер, фото, VIN, комплектация
- OG-изображение для каждого нового авто
- Стражник от пустого фида — если фид вернул 0 автомобилей, удаление пропускается
- Форматированный YML-фид: `GET /api/feed/yml`

### Б/у авто

- Синхронизация через Auto.ru API (фид)
- Таблица `cars` (type=`used`), поля: марка, модель, год, пробег, цвет, кол-во владельцев, VIN, фото
- `owners_number` парсится из текста («Один владелец» → 1)
- Популярность: `popularity_score` + `car_views` таблица
- Экспорт в To-Catalog: `/api/to-catalog/*` (модели, модификации, записи)

### Оценка авто (trade-in)

- `GET /api/cars/estimate` — оценка через CM Expert Predict API
- `GET /api/cm-expert/brands`, `/models`, `/years` — справочники для формы оценки на `/buyout`

---

## Сервисные страницы

### Бонусная программа (`/service/bonus`)

- Контент из таблицы `settings` (ключ `bonus_program`)
- Условия, начисление баллов, список участвующих брендов

### Выкуп и комиссия (`/buyout`)

- Форма оценки авто (марка/модель/год через CM Expert API)
- Формы заявки через `POST /api/send-email`
- Список локаций выкупа с адресами и часами
- В шапке автоматически показывается телефон локации «Супонево» (из таблицы `locations`)

### Корпоративное ТО (`/corporate`)

- CMS-страница: управляется через `GET/PUT /api/corporate-page`
- Загрузка фото: `POST /api/corporate-page/photo`
- FAQ-блок

---

## Административная панель

URL (продакшн): `https://debryansk-auto.ru/admin/`

### Разделы

| Раздел | Описание |
|---|---|
| **Дашборд** | Статистика лидов, просмотров, новых авто |
| **Новости** | CRUD + Markdown-редактор + загрузка фото |
| **Акции** | CRUD промо-акций, привязка к брендам, дисклеймеры |
| **Бренды** | Управление брендами, slug, is_service_only, локации, контент (описание, модели, услуги) |
| **Локации** | Адреса, телефоны, карта, часы, привязка брендов |
| **Лиды** | Таблица всех заявок с фильтрами и статусами |
| **Отзывы** | Модерация отзывов из GetLoyalty (Яндекс/2ГИС) |
| **FAQ** | Вопросы-ответы по разделам (главная, выкуп, сервис, корпоративный) |
| **Вакансии** | Просмотр вакансий из hh.ru |
| **Дилеры** | Управление дилерскими точками |
| **Дисклеймеры** | Версионируемые юридические оговорки для акций |
| **Менеджеры** | Учётные записи менеджеров и прав доступа |
| **Продавцы** | Записи sales-менеджеров |
| **Пользователи** | Административные пользователи |
| **Корпоративная** | Редактирование страницы `/corporate` |
| **Настройки** | Глобальные настройки сайта (header_phone, SMTP и др.) |
| **Calltouch** | Просмотр звонков, записей, статистики |
| **Посетители** | Онлайн-счётчик посетителей |
| **Навигатор** | Диалоги AI Навигатора, quick-ответы |
| **Каталог** | Экспорт в To-Catalog |
| **AI Изображения** | Галерея сгенерированных AI-изображений |
| **Бренд-гайдлайны** | Управление брендбуком |
| **SEO-хаб** | Технический SEO-центр (см. [SEO-центр](#seo-центр)) |
| **SEO Автопилот** | ИИ-генерация страниц и FAQ |
| **SEO Позиции** | Отслеживание позиций в Яндекс |
| **Prerender-монитор** | Статус prerender-кэша и ошибок |

---

## Портал менеджеров

URL: `/manager/login`, `/manager/quotes`, `/manager/profile`

Отдельный вход по JWT (разделяет права менеджера и администратора).

### Коммерческие предложения (КП)

- `GET /api/manager/quotes` — список КП
- `POST /api/manager/quotes` — создание КП с подбором авто
- `GET /api/manager/quotes/:id/pdf` — генерация PDF-документа через HTML-шаблон
- Поиск авто: `GET /api/manager/car-brands`, `/car-models`, `/car-search`
- Шаблон КП (`kp-template.html`) + логотип компилируются в бандл через esbuild

---

## API-сервер

### Публичные эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/settings` | Глобальные настройки сайта |
| GET | `/api/brands` | Список брендов |
| GET | `/api/brands/:slug` | Данные бренда + локации + авто |
| GET | `/api/locations` | Все локации с телефонами и часами |
| GET | `/api/brand-locations` | Карта бренд → локация → телефон |
| GET | `/api/cars/new` | Каталог новых авто |
| GET | `/api/cars/used` | Каталог б/у авто |
| GET | `/api/cars/estimate` | Оценка авто через CM Expert Predict |
| GET | `/api/cars/featured` | Рекомендованные авто |
| POST | `/api/cars/views/used/:id` | Инкремент просмотра б/у авто |
| GET | `/api/news` | Список статей |
| GET | `/api/news/:slug` | Одна статья |
| GET | `/api/promotions` | Список акций |
| GET | `/api/promotions/:slug` | Одна акция |
| GET | `/api/reviews` | Отзывы |
| GET | `/api/reviews/aggregate` | Средняя оценка + кол-во |
| GET | `/api/faq` | FAQ по разделу |
| GET | `/api/locations` | Локации дилера |
| GET | `/api/brand-locations` | Телефоны по брендам |
| GET | `/api/hh-vacancies` | Вакансии с hh.ru |
| GET | `/api/bonus-program` | Описание бонусной программы |
| GET | `/api/corporate-page` | Контент корпоративной страницы |
| GET | `/api/p/:slug` | Лендинг-страница |
| GET | `/api/cm-expert/brands` | Справочник марок (CM Expert) |
| GET | `/api/car-catalog/*` | Справочники Auto.ru / CM Expert |
| POST | `/api/chat` | AI Навигатор (обычный) |
| POST | `/api/chat/stream` | AI Навигатор (streaming SSE) |
| POST | `/api/chat/rate` | Рейтинг ответа Навигатора |
| POST | `/api/send-email` | Отправка заявки/лида по email |
| GET | `/api/feed/yml` | YML-фид автомобилей |
| GET | `/sitemap.xml` | XML-карта сайта |
| GET | `/sitemaps.xml` | 301 → `/sitemap.xml` |
| GET | `/api/og/*` | OG-изображения (Puppeteer) |

### Admin эндпоинты (`/api/admin/*`)

Защищены JWT-миддлварой `requireAdmin`.

| Группа | Описание |
|---|---|
| `/api/admin/news` | CRUD новостей + загрузка фото |
| `/api/admin/brands` | CRUD брендов + контент |
| `/api/admin/locations` | CRUD локаций + привязка брендов |
| `/api/admin/promotions` | CRUD акций + дисклеймеры |
| `/api/admin/leads` | Управление лидами |
| `/api/admin/reviews` | Модерация отзывов |
| `/api/admin/faq` | CRUD FAQ |
| `/api/admin/vacancies` | Просмотр вакансий hh.ru |
| `/api/admin/managers` | CRUD менеджеров |
| `/api/admin/sales-managers` | CRUD продавцов |
| `/api/admin/users` | CRUD пользователей |
| `/api/admin/corporate-page` | Редактирование корпоративной страницы |
| `/api/admin/settings` | Чтение/запись настроек |
| `/api/admin/calltouch` | Звонки и записи Calltouch |
| `/api/admin/online` | Онлайн-счётчик посетителей |
| `/api/admin/navigator` | Диалоги + force-sync каталога |
| `/api/admin/to-catalog` | Экспорт в To-Catalog |
| `/api/admin/ai-images` | Галерея AI-изображений |
| `/api/admin/cache/*` | Управление prerender-кэшем |
| `/api/admin/seo/*` | SEO-хаб (аудит, страницы) |
| `/api/admin/seo-anchor` | CRUD якорных запросов |
| `/api/admin/seo-autopilot/*` | SEO Автопилот (предложения, применение) |
| `/api/admin/seo-positions` | Позиции в Яндекс |
| `/api/admin/og` | Сброс OG-кэша |
| `/api/admin/disclaimers` | CRUD дисклеймеров + версии |
| `/api/admin/storage` | Управление файлами в Object Storage |

### Middleware

| Middleware | Описание |
|---|---|
| `prerender.ts` | Отдаёт Puppeteer-кэш ботам; пропускает SSG-маршруты и prerender-боты |
| `seoMeta.ts` | Инжектирует meta-теги, canonical, JSON-LD, H1 в статический HTML для ботов; мягкий 404 для неизвестных маршрутов |
| `requireAdmin.ts` | JWT-проверка прав администратора |
| `requireManager.ts` | JWT-проверка прав менеджера |

---

## SEO-центр

Доступен в админке: `/seo-hub`, `/seo-autopilot`, `/seo-positions`

### SSG (Static Site Generation)

Скрипт `scripts/ssg.mjs` запускается при `pnpm build` и генерирует статические HTML для всех маршрутов:

**Статические маршруты**: `/`, `/new-cars`, `/cars`, `/service`, `/service/bonus`, `/buyout`, `/about`, `/contacts`, `/news`, `/vacancies`, `/privacy`, `/legal`, `/corporate`

**Динамические маршруты**: `/brands/:slug`, `/news/:slug`, `/new-cars/:id`, `/cars/:id`, `/promotions/:slug`

Каждый HTML содержит инжектированные meta-теги, H1, JSON-LD schema.org для ботов.

### Prerender (SSR через Puppeteer)

- Chrome stable на VPS, pool size=2 (ограничение памяти)
- Кэш в Google Cloud Storage (GCS) + in-memory
- Маркер готовности: `<div data-prerender-ready="true">` в React-компоненте
- Автоматический rebuild при добавлении новых авто
- Ручной rebuild: `POST /api/admin/cache/prerender/route { route: "/" }`
- Bulk rebuild: `POST /api/admin/cache/prerender/bulk`
- Защита: SSG-маршруты не пишутся в prerender-кэш (разделение ответственности)
- Sentry для crash-детекции OOM

### OG-изображения

- Генерация через Puppeteer 1200×630 PNG
- Маршруты: `/api/og/brand/:slug`, `/api/og/car/:id`, `/api/og/new-car/:id`, `/api/og/service`, `/api/og/corporate`, `/api/og/catalog`
- Кэш: 7 дней на диске VPS (`/opt/debryansk/og-cache/`)
- Семафор Chrome: 1500 ms acquire timeout
- Патчинг `og:image` в HTML prerender-кэша при обновлении

### Динамический sitemap

- `GET /sitemap.xml` — XML с приоритетами: главная 1.0, каталоги 0.9, бренды 0.85, авто 0.7, новости 0.7
- `GET /sitemaps.xml` → 301 → `/sitemap.xml`
- IndexNow: автопинг Яндекс при публикации новых страниц

### SEO Автопилот

- Ежедневный сбор Wordstat (Яндекс Wordstat API) — ~360 фраз
- Ежедневный сбор данных из Яндекс.Вебмастер — ~500 поисковых запросов
- GAP-движок: сравнение позиций с конкурентами, генерация предложений
- AI-генерация контента: FAQ, текстовые блоки, meta-описания через GPT-4.1 (Timeweb Gateway)
- Кэш AI-результатов: таблица `seo_ai_cache`
- Примеры для few-shot: таблица `seo_ai_examples`
- Статусы предложений: `pending`, `applied`, `rejected`
- Таблицы: `seo_suggestions`, `gap_runs`, `wordstat_snapshots`, `seo_ai_cache`

### Позиции в Яндекс

- `GET /api/admin/seo-positions/fetch` — запрос текущих позиций
- `GET /api/admin/seo-positions/latest` — последний снимок
- `GET /api/admin/seo-positions/history` — история по запросу
- `GET /api/admin/seo-positions/commercial` — коммерческие запросы

### Якорные запросы

- CRUD через `/api/admin/seo-anchor`
- 10+ настроенных якорных запросов для мониторинга
- AI-предложения новых запросов на основе данных Вебмастера

### Security Headers

Все ответы API содержат:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`

---

## Внешние интеграции

### CM Expert

- **Клиент**: `lib/cm-expert-client.ts`
- Каталог марок/моделей/поколений/кузовов/годов/модификаций
- Оценка авто: `GET /api/cm-expert/*`
- Predict API: оценочная стоимость по параметрам

### Auto.ru

- **API**: `apiauto.ru` (auth: `x-authorization`)
- Фид б/у автомобилей: синхронизация при старте + каждые 30 минут
- Справочник марок и моделей: `GET /api/car-catalog/*`

### Calltouch

- **Endpoint**: `calls-service/RestAPI/{siteId}/calls-diary/calls`
- Синхронизация звонков: GET по времени
- Вебхуки: `POST /api/webhooks/calltouch/call-start`, `/call-complete`
- Записи разговоров: хранятся в таблице `calltouch_calls`
- Просмотр в админке: `/calltouch`

### GetLoyalty

- **API**: `POST /api/v2/reviews`, Bearer token
- Синхронизация отзывов: Яндекс Карты + 2ГИС
- Фильтр: оценка 4–5★, не старше 90 дней, без исключённых
- Защита от pagination wrap-around: дедупликация по firstId
- ~6–10 активных отзывов в БД

### hh.ru (HeadHunter)

- OAuth2: `HH_CLIENT_ID`, `HH_CLIENT_SECRET`
- Токены: `lib/hh-token.ts` (auto-refresh)
- Вакансии работодателя: `GET /api/hh-vacancies`

### Яндекс Метрика

- Токен: `YANDEX_METRIKA_TOKEN`
- Ежедневные отчёты: просмотры, сессии, источники
- Данные используются в дашборде

### Яндекс Вебмастер / Wordstat

- Токены: `YANDEX_WEBMASTER_TOKEN`, `YANDEX_WORDSTAT_API_KEY`
- Ежедневный сбор поисковых запросов и позиций
- Данные хранятся в `wordstat_snapshots`, `seo_positions`

### IndexNow

- Автопинг Яндекс при публикации новых SEO-страниц
- Таблица отслеживания статических страниц

### OpenAI / Timeweb AI Gateway

- **Модели**: `gpt-5-mini` (Навигатор), `gpt-4.1` (SEO-тексты)
- **Базовый URL**: `TIMEWEB_AI_GATEWAY_KEY` → `https://api.timeweb.ai/v1`
- Генерация текстов: FAQ, meta-описания, заголовки, блоки контента
- Генерация изображений через Gemini (ответ в `message.images[0].image_url.url`)
- Голосовой ввод: `lib/integrations-openai-ai-react` (запись + транскрипция)

---

## Медиа и хранилище

### Object Storage (Replit / GCS)

- **Загрузка**: `POST /api/storage/upload`
- **Получение**: `GET /api/storage/public/:path`
- **Прямой URL**: `GET /api/storage/direct/:path`
- Публичные пути настраиваются через `PUBLIC_OBJECT_SEARCH_PATHS`
- Приватная директория: `PRIVATE_OBJECT_DIR`

### Изображения

- Все загруженные фото конвертируются в WebP (~95% экономия)
- Мобильные варианты для hero-изображений
- Lazy loading + `async decoding` для некритичных изображений
- `<picture>` + srcset для адаптивного hero

### OG-изображения

Puppeteer-рендеринг с кэшем на диске VPS:
- Бренд-страницы: `/api/og/brand/:slug`
- Новые авто: `/api/og/new-car/:id`
- Б/у авто: `/api/og/car/:id`

---

## Email и уведомления

- **Транспорт**: Nodemailer SMTP
- **Тип заявок**: обратный звонок, запись на ТО, запрос КП, форма оценки, trade-in
- **Получатели**: настраиваются через `SMTP_*` переменные окружения
- **Эндпоинт**: `POST /api/send-email` (multipart/form-data)
- **Тест**: `GET /api/send-email/test`

---

## Производство (VPS)

**Сервер**: Timeweb VPS, IP `5.42.110.134`, 2 vCPU, 1 GB RAM

### Стек

```
Nginx (80/443, SSL) → Express API (localhost:8080)
                           ├── PM2 (process manager)
                           ├── PostgreSQL (localhost)
                           ├── Chrome stable (prerender)
                           └── /opt/debryansk/
                                   ├── api/        ← esbuild bundle (index.mjs)
                                   ├── frontend/   ← Vite build (dist/public)
                                   ├── admin/      ← Admin panel build
                                   ├── uploads/    ← Загруженные файлы
                                   ├── og-cache/   ← OG-изображения
                                   └── .env        ← Переменные окружения
```

### Деплой

```bash
# Полный деплой (API + фронтенд)
./scripts/deploy-vps.sh

# Только API
pnpm --filter @workspace/api-server run build
scp artifacts/api-server/dist/index.mjs root@VPS:/opt/debryansk/api/

# Только фронтенд
pnpm --filter @workspace/debryansk-avto run build
tar -czf /tmp/fe.tar.gz -C artifacts/debryansk-avto/dist/public .
scp /tmp/fe.tar.gz root@VPS:/tmp/
ssh root@VPS "tar -xzf /tmp/fe.tar.gz -C /opt/debryansk/frontend/"

# Только admin-панель (BASE_PATH=/admin/)
cd artifacts/admin-panel && BASE_PATH=/admin/ NODE_ENV=production vite build
scp -r dist/public/. root@VPS:/opt/debryansk/admin/
```

### PM2

```bash
pm2 list                          # Статус процессов
pm2 restart debryansk-avto        # Перезапуск API (id=2)
pm2 logs debryansk-avto           # Логи
```

### Nginx

- SSL от Let's Encrypt
- `ssl_buffer_size 4k` — обязательно для TLS-производительности
- `/admin` → `/opt/debryansk/admin/` (статика)
- `/` → `localhost:8080` (Express)

---

## Разработка

### Предварительные требования

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+

### Установка

```bash
git clone https://github.com/skodabryansk-collab/debryansk-avto
cd debryansk-avto
pnpm install
```

### Запуск

```bash
# Все сервисы (через Replit workflows)
# — или по отдельности:

# API-сервер
pnpm --filter @workspace/api-server run dev

# Публичный сайт
pnpm --filter @workspace/debryansk-avto run dev

# Административная панель
pnpm --filter @workspace/admin-panel run dev
```

### Сборка

```bash
# Публичный сайт (с SSG-генерацией)
pnpm --filter @workspace/debryansk-avto run build

# API-сервер (esbuild bundle)
pnpm --filter @workspace/api-server run build

# Admin-панель
cd artifacts/admin-panel && BASE_PATH=/admin/ NODE_ENV=production vite build
```

### Миграции БД

```bash
pnpm --filter @workspace/api-server run migrate
# или
pnpm --filter @workspace/db run migrate
```

### Структура сборки фронтенда

Vite code splitting по чанкам (manualChunks):

| Чанк | Содержимое | ~Размер |
|---|---|---|
| `vendor-react` | react, react-dom | 185 KB |
| `vendor-motion` | framer-motion | 126 KB |
| `vendor-ui` | Radix UI, lucide | 89 KB |
| `vendor-query` | @tanstack/react-query | 33 KB |
| `vendor-router` | wouter | 8 KB |
| `index` | Общие компоненты | 151 KB |
| `home` | Главная страница | ~158 KB |
| Страницы | По 6–68 KB каждая | ≤68 KB |

Первая загрузка: ~600 KB. Повторные переходы: только чанк страницы.

---

## Переменные окружения

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Секрет сессий Express |
| `ADMIN_JWT_SECRET` | JWT для администраторов |
| `ADMIN_LOGIN` | Логин по умолчанию |
| `ADMIN_PASSWORD` | Пароль по умолчанию |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email-транспорт |
| `AUTORU_API_KEY` / `AUTORU_LOGIN` / `AUTORU_PASSWORD` | Auto.ru API |
| `CMEXPERT_CLIENT_ID` / `CMEXPERT_CLIENT_SECRET` | CM Expert API |
| `GETLOYALTY_API_KEY` | GetLoyalty (отзывы) |
| `HH_CLIENT_ID` / `HH_CLIENT_SECRET` | HeadHunter API |
| `CALLTOUCH_WEBHOOK_SECRET` | Подпись вебхуков Calltouch |
| `YANDEX_METRIKA_TOKEN` | Яндекс Метрика |
| `YANDEX_WEBMASTER_TOKEN` | Яндекс Вебмастер |
| `YANDEX_WORDSTAT_API_KEY` | Яндекс Wordstat |
| `TIMEWEB_AI_GATEWAY_KEY` | Timeweb AI Gateway (OpenAI-совместимый) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API (Replit proxy) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Base URL для OpenAI proxy |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | GCS bucket ID |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Пути для публичного доступа к объектам |
| `PRIVATE_OBJECT_DIR` | Приватная директория Object Storage |
| `FRONTEND_DIST_PATH` | Путь до `dist/public` (для API-сервера) |
| `VPS_SSH_PASSWORD` | SSH-пароль VPS |

---

## Лицензия

Внутренний проект ООО «Дебрянск Авто» (группа компаний 9 БР). Все права защищены.
