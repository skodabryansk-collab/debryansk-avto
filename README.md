# Дебрянск Авто

<p align="center">
  <strong>Мультибрендовый автомобильный дилерский портал</strong><br>
  <em>Официальный сайт: <a href="https://debryansk-avto.ru">debryansk-avto.ru</a></em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/TailwindCSS-4-38B2AC?logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express" alt="Express">
  <img src="https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/pnpm-monorepo-F69220?logo=pnpm" alt="pnpm">
</p>

---

## Содержание

- [О проекте](#о-проекте)
- [Технологический стек](#технологический-стек)
- [Архитектура](#архитектура)
- [Публичный сайт](#публичный-сайт)
- [Бренд-страницы](#бренд-страницы)
- [AI Навигатор](#ai-навигатор)
- [Административная панель](#административная-панель)
- [API-сервер](#api-сервер)
- [Внешние интеграции](#внешние-интеграции)
- [Email-уведомления](#email-уведомления)
- [SEO и производительность](#seo-и-производительность)
- [Структура проекта](#структура-проекта)
- [Разработка](#разработка)

---

## О проекте

**Дебрянск Авто** — полнофункциональный веб-портал мультибрендовой дилерской группы, расположенной в Брянске. Включает публичный сайт для покупателей, полноценную административную панель и REST API-сервер.

Сайт интегрирован с внешними сервисами: **CM Expert** (оценка и каталог), **Auto.ru** (справочник марок/моделей), **hh.ru** (вакансии), **GetLoyalty** (отзывы с Яндекс/2ГИС), **Nodemailer SMTP** (email-уведомления) и **Google Cloud Storage** (хранилище медиафайлов).

### Представленные бренды
- **Новые автомобили**: OMODA, JAECOO, Haval City, Haval Pro, Jetour, Tenet, EXEED, Mercedes-Benz, Volkswagen, SKODA
- **Автомобили с пробегом**: Все марки (Skoda, BMW, Audi, Volkswagen, Toyota и др.)

---

## Технологический стек

### Frontend (`artifacts/debryansk-avto`)

| Технология | Назначение |
|---|---|
| **React 19** | UI-фреймворк |
| **Vite 7** | Сборка и dev-сервер |
| **TypeScript** | Строгая типизация |
| **Tailwind CSS 4** | Utility-first стилизация |
| **wouter** | Лёгкий роутинг (1.5 KB) |
| **@tanstack/react-query** | Серверное состояние, кэширование |
| **react-helmet-async** | Динамические SEO meta-теги |
| **framer-motion** | Анимации и переходы |
| **lucide-react** | Иконки |
| **Яндекс Карты JS API 3.0** | Интерактивные карты дилеров и бренд-страниц |
| **shadcn/ui** | 50+ UI-компонентов |

### Admin Panel (`artifacts/admin-panel`)

| Технология | Назначение |
|---|---|
| **React 19** | UI-фреймворк |
| **Vite 7** | Сборка |
| **TanStack Query** | Загрузка и мутации данных |
| **shadcn/ui** | UI-компоненты (DataTable, Form, Dialog) |
| **recharts** | Графики на дашборде |

### Backend (`artifacts/api-server`)

| Технология | Назначение |
|---|---|
| **Express 5** | HTTP-сервер |
| **Drizzle ORM** | Type-safe работа с БД |
| **PostgreSQL** | Реляционная база данных |
| **Nodemailer** | Отправка email-уведомлений |
| **Puppeteer** | Серверный пре-рендер для SEO-ботов |
| **esbuild** | Сборка сервера |

---

## Архитектура

```
workspace/ (pnpm monorepo)
├── artifacts/
│   ├── debryansk-avto/      → Публичный сайт (React SPA + SSG)
│   ├── admin-panel/         → Административная панель (React SPA)
│   ├── api-server/          → REST API + email + интеграции (Express)
│   └── mockup-sandbox/      → Изолированная среда для прототипов UI
│
├── lib/
│   ├── db/                  → Drizzle схема + PostgreSQL (schema, migrations)
│   └── api-zod/             → Zod-схемы, общие типы
│
└── scripts/                 → Утилиты: SSG, импорт данных
```

### Поток данных

```
CM Expert XML / Auto.ru API → API-сервер → PostgreSQL → React-Query → UI
Формы (лиды) → POST /api/send-email → SMTP + БД leads_table
Медиафайлы → presigned URL → Google Cloud Storage → публичные URL
SEO-бот → middleware → Puppeteer prerender → кэш GCS → HTML-ответ
```

---

## Публичный сайт

### Страницы

| Путь | Описание |
|---|---|
| `/` | Главная: hero-баннер, бренды, карусели авто, новости, карта дилеров, AI Навигатор |
| `/new-cars` | Каталог новых автомобилей с фильтрами, сортировкой, поддержкой `?dealer=` и `?model=` |
| `/new-cars/:id` | Карточка нового авто: фото, характеристики, комплектация, скидки |
| `/cars` | Каталог автомобилей с пробегом |
| `/cars/:id` | Карточка б/у авто: фото, VIN, ПТС, история владельцев |
| `/brands` | Список брендов дилерской группы |
| `/brands/:slug` | Бренд-страница: модельный ряд, спецпредложения, карта, новости, сервис |
| `/buyout` | Выкуп автомобилей: многошаговая форма с онлайн-оценкой CM Expert |
| `/compare` | Сравнение до 3 автомобилей по характеристикам и опциям |
| `/favorites` | Избранные авто (localStorage) |
| `/service` | Сервисный центр: услуги, онлайн-запись |
| `/news` | Новости и статьи компании |
| `/news/:slug` | Детальная страница новости с SEO и JSON-LD |
| `/vacancies` | Вакансии (синхронизация с hh.ru + ручные позиции) |
| `/about` | О компании: история, бренды, статистика |
| `/contacts` | Контакты: дилерские центры с интерактивной Яндекс Картой |
| `/privacy` | Политика конфиденциальности |

### Модальные формы (Lead Generation)

| Модаль | Функционал |
|---|---|
| **Заказать звонок** | Имя + телефон → email-уведомление |
| **Тест-драйв** | Выбор даты/времени, дилерского центра → email |
| **Кредитный калькулятор** | Взнос, срок, платёж, итоговая сумма → email |
| **Trade-in** | Оценка через CM Expert API, включает данные целевого авто → email |
| **Выкуп** | Многошаговая форма с оценкой CM Expert → email |
| **Заявка на вакансию** | Имя, телефон, позиция → email |

### Возможности каталога

- Двойной каталог: новые (`/new-cars`) и с пробегом (`/cars`)
- Фильтрация по бренду, модели, типу кузова, трансмиссии, приводу, цене, году, пробегу
- Поиск по названию, модели, VIN
- Сортировка: по цене, году, пробегу, дате добавления
- Сравнение до 3 автомобилей (localStorage)
- Избранное (localStorage)
- Адаптивные WebP-изображения с lazy loading
- Отображение скидок (кредитная, trade-in, итоговая цена)
- Похожие автомобили и рекомендации на карточке

---

## Бренд-страницы

Каждый бренд имеет полноценный лендинг по пути `/brands/:slug` со следующими секциями:

| Секция | Содержимое |
|---|---|
| **Hero** | Логотип бренда, кнопки Тест-драйв / Заказать звонок / Сайт бренда |
| **О бренде** | Текстовое описание (управляется из админки) |
| **Модельный ряд** | Карточки моделей с фото, типом кузова, ценой. HAVAL — статичный каталог (8 моделей) |
| **В наличии** | До 6 актуальных авто со скидками из фида |
| **Сервис** | Гарантийное обслуживание, преимущества, кнопка записи на ТО |
| **Новости** | До 4 новостей, привязанных к бренду или упоминающих его в тексте |
| **Контакты** | Встроенная Яндекс Карта с маркером + адрес, телефон, режим работы |

### Привязка новостей к бренду

Новости можно явно привязать к бренду через поле `brand_id` (таблица `news`). В форме редактирования новости в админке — выпадающий список брендов (опциональное поле). API бренд-страницы возвращает сначала статьи с совпадающим `brand_id`, затем дополняет text-match по названию (до 4 итого).

---

## AI Навигатор

Виджет искусственного интеллекта в правом нижнем углу главной страницы.

| Параметр | Значение |
|---|---|
| **Модель** | GPT-5-mini (JSON mode) |
| **Каталог** | 50 б/у + 60 новых авто инжектируется в системный промпт |
| **Ответ** | `{ reply, car_ids[], action }` — может рекомендовать конкретные авто |
| **Персистентность** | История чата сохраняется в `localStorage` (`nav_messages_<session_id>`) |
| **Лимит** | 60 сообщений на сессию, очищается при отказе от обработки данных |
| **Скидки** | Навигатор знает о `max_discount`, `credit_discount`, `tradein_discount` |

---

## Административная панель

Полноценный back-office на `/admin-panel`:

| Раздел | Функционал |
|---|---|
| **Дашборд** | Статистика заявок, новостей, состояние системы |
| **Заявки (Leads)** | Все обращения с сайта: тип, имя, телефон, авто, дата; экспорт CSV |
| **Бренды** | CRUD брендов: название, логотип, slug, активность; редактор контента бренд-страницы |
| **Локации** | Дилерские центры: адрес, телефон, координаты, привязка брендов |
| **Новости** | CRUD статей: заголовок, slug, содержание, изображения, привязка к бренду |
| **Отзывы** | Синхронизация с GetLoyalty (Яндекс / 2ГИС), управление отображением |
| **Навигатор** | История диалогов AI-ассистента, экспорт в JSONL для дообучения |
| **Вакансии** | Ручные вакансии (дополнение hh.ru) |
| **Настройки сайта** | SEO-настройки, контакты, телефоны — применяются динамически |
| **Пользователи** | Управление доступом к панели |

---

## API-сервер

### Публичные эндпойнты

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/cars/used` | Автомобили с пробегом (фильтры: brand, body, price, year и др.) |
| GET | `/api/cars/new` | Новые автомобили |
| GET | `/api/cars/featured` | Избранные авто для главной |
| GET | `/api/news` | Список новостей |
| GET | `/api/news/:slug` | Новость по slug |
| GET | `/api/brands` | Список брендов с числом авто |
| GET | `/api/brands/:slug` | Бренд-страница: бренд + контент + локации + авто + новости |
| GET | `/api/locations` | Дилерские центры |
| GET | `/api/brand-locations` | Телефон/локация по бренду (для динамических контактов) |
| GET | `/api/settings` | Настройки сайта (SEO, телефоны, адреса) |
| GET | `/api/hh-vacancies` | Вакансии с hh.ru (RSS + API) |
| GET | `/api/reviews` | Отзывы (GetLoyalty: Яндекс / 2ГИС) |
| POST | `/api/send-email` | Отправка заявок (8 типов) + сохранение лида в БД |

### CM Expert эндпойнты

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/car-catalog/cm-brands` | Марки из CM Expert |
| GET | `/api/car-catalog/cm-models` | Модели по марке |
| GET | `/api/car-catalog/cm-generations` | Поколения по марке + модели + году |
| GET | `/api/car-catalog/cm-bodies` | Типы кузова |
| GET | `/api/car-catalog/cm-years` | Доступные годы выпуска |
| GET | `/api/car-catalog/cm-expert-predict` | Онлайн-оценка выкупной стоимости |

### Административные эндпойнты

| Метод | Путь | Описание |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/admin/leads` | Управление заявками |
| GET/POST/PUT/DELETE | `/api/admin/brands` | CRUD брендов |
| GET/PUT | `/api/admin/brand-pages/:id` | Контент бренд-страницы (описание, FAQ, преимущества) |
| GET/POST/PUT/DELETE | `/api/admin/locations` | CRUD локаций + привязка брендов |
| GET/POST/PUT/DELETE | `/api/admin/news` | CRUD новостей (включая brand_id) |
| GET/POST/PUT/DELETE | `/api/admin/settings` | Настройки сайта |
| GET/POST | `/api/admin/reviews` | Отзывы + синхронизация с GetLoyalty |
| GET/POST | `/api/admin/navigator/chats` | История AI-диалогов, экспорт JSONL |
| POST | `/api/admin/navigator/sync-cars` | Принудительная синхронизация каталога авто в Navigator |
| POST | `/api/storage/uploads/request-url` | Presigned URL для загрузки в GCS |

---

## Внешние интеграции

| Сервис | Назначение | Статус |
|---|---|---|
| **CM Expert** | Оценка стоимости авто, справочник марок/моделей/поколений, фид авто | ✅ Реализовано |
| **Auto.ru API** | Справочник брендов и моделей для каталога | ✅ Реализовано |
| **hh.ru** | Синхронизация вакансий (RSS + API) | ✅ Реализовано |
| **GetLoyalty** | Синхронизация отзывов с Яндекс Карт и 2ГИС | ✅ Реализовано |
| **OpenAI GPT** | AI Навигатор — чат-ассистент по подбору авто | ✅ Реализовано |
| **Яндекс.Карты JS API 3.0** | Карты на страницах Контакты, Главная, бренд-страницы | ✅ Реализовано |
| **SMTP (Timeweb)** | Отправка email-уведомлений о заявках | ✅ Реализовано |
| **Google Cloud Storage** | Хранение изображений (загрузки из админки, prerender-кэш) | ✅ Реализовано |
| **IndexNow** | Мгновенное уведомление поисковиков о новых URL | ✅ Реализовано |

---

## Email-уведомления

При каждой заявке отправляется HTML-письмо с логотипом Дебрянск Авто на адрес `sales@debryansk-auto.ru`. Все заявки также сохраняются в таблице `leads` в PostgreSQL.

| Тип (`type`) | Тема письма | Форма |
|---|---|---|
| `callback` | 📞 Заказать звонок | Хедер сайта |
| `testdrive` | 🏁 Тест-драйв | Карточка нового авто |
| `credit` | 💳 Автокредит | Карточки авто |
| `tradein` | 🔄 Trade-in | Карточки авто + включает целевой авто |
| `buyout` | 💰 Выкуп автомобиля | Страница `/buyout` |
| `vacancy` | 💼 Отклик на вакансию | Страница `/vacancies` |
| `openresume` | 📋 Открытый отклик | Страница `/vacancies` |
| `feedback` | ✉️ Форма контактов | Страница `/contacts` |

---

## SEO и производительность

| Оптимизация | Детали |
|---|---|
| **Серверный пре-рендер** | Puppeteer + Chromium: боты получают полный HTML, обычные пользователи — SPA |
| **SSG (Static Site Generation)** | Критические маршруты генерируются как статические HTML при сборке |
| **Schema.org JSON-LD** | AutoDealer, Vehicle/Car (VIN, fuelType, itemCondition), ItemList, BreadcrumbList, NewsArticle |
| **BreadcrumbList** | На всех страницах сайта |
| **Open Graph** | `og:title`, `og:description`, `og:image`, `og:locale:ru_RU` на каждой странице |
| **Twitter Cards** | `summary_large_image` |
| **Canonical URLs** | Предотвращение дублирования контента |
| **React Helmet Async** | Динамические `<title>` и `<meta>` для каждой страницы |
| **sitemap.xml** | Все статические страницы + приоритеты |
| **robots.txt** | Правила для поисковых роботов |
| **IndexNow** | Мгновенная индексация при публикации новостей |
| **WebP-изображения** | Все PNG/JPG конвертированы в WebP (−95% размер) |
| **Адаптивный `<picture>`** | `srcset` с мобильными вариантами для hero |
| **Lazy loading** | `loading="lazy"` + `decoding="async"` для всех некритических изображений |
| **SVG-оптимизация** | Очистка неймспейсов, объединение путей, короткие ID градиентов |

---

## Структура проекта

### Публичный сайт (`artifacts/debryansk-avto/src/`)

```
src/
├── App.tsx                    # Роутинг (wouter)
├── pages/
│   ├── home.tsx               # Главная (standalone, без Layout — AI Навигатор встроен напрямую)
│   ├── brand-page.tsx         # Бренд-страница (/brands/:slug) — карта, модели, новости
│   ├── cars.tsx               # Каталог б/у
│   ├── new-cars.tsx           # Каталог новых (+ ?dealer= и ?model= из URL)
│   ├── car-detail.tsx         # Карточка б/у авто
│   ├── new-car-detail.tsx     # Карточка нового авто
│   ├── buyout.tsx             # Страница выкупа с CM Expert оценкой
│   ├── compare.tsx            # Сравнение автомобилей
│   ├── favorites.tsx          # Избранное
│   ├── news.tsx               # Новости
│   ├── news-detail.tsx        # Детальная новости
│   ├── service.tsx            # Сервисный центр
│   ├── vacancies.tsx          # Вакансии
│   ├── about.tsx              # О компании
│   ├── contacts.tsx           # Контакты + Яндекс Карта всех дилеров
│   └── not-found.tsx          # 404
│
├── components/
│   ├── Layout.tsx             # Шапка + подвал (телефоны из БД, Schema.org)
│   ├── SEO.tsx                # SEO: meta, JSON-LD, BreadcrumbList
│   ├── YandexMap.tsx          # Яндекс Карта JS API 3.0 (контакты, главная, бренды)
│   ├── ChatWidget.tsx         # AI Навигатор (виджет)
│   ├── CarActionButtons.tsx   # Кнопки избранного/сравнения
│   └── modals/
│       ├── CallbackModal.tsx  # Заказать звонок
│       ├── TestDriveModal.tsx # Запись на тест-драйв
│       ├── CreditModal.tsx    # Кредитный калькулятор
│       └── TradeInModal.tsx   # Trade-in (с оценкой CM Expert + целевой авто)
│
└── hooks/
    ├── useCarStorage.ts       # localStorage: избранное, сравнение
    └── use-toast.ts           # Toast-уведомления
```

### API-сервер (`artifacts/api-server/src/`)

```
src/
├── index.ts                   # Точка входа Express + prerender middleware
├── routes/
│   ├── cars.ts                # /api/cars/*
│   ├── public-brands.ts       # /api/brands/* (список + бренд-страница)
│   ├── admin-news.ts          # /api/admin/news (CRUD + brand_id)
│   ├── admin-brands.ts        # /api/admin/brands + brand-pages content
│   ├── email.ts               # POST /api/send-email (8 типов, HTML-шаблоны)
│   ├── navigator.ts           # AI Навигатор: чат, синхронизация каталога
│   ├── reviews.ts             # GetLoyalty интеграция (Яндекс / 2ГИС)
│   ├── carCatalog.ts          # /api/car-catalog/* (CM Expert + Auto.ru)
│   ├── hh.ts                  # /api/hh-vacancies
│   └── settings.ts            # /api/settings, /api/brand-locations
└── services/
    ├── indexnow.ts            # Пинг IndexNow при публикации
    └── prerender.ts           # Puppeteer SSR для SEO-ботов
```

### База данных (`lib/db/src/schema/`)

| Таблица | Описание |
|---|---|
| `brands` | Бренды: name, slug, logoUrl, bgColor, isServiceOnly |
| `brand_page_content` | Контент бренд-страниц: description, serviceText, FAQ, advantages |
| `cars` | Автомобили (новые + б/у): из CM Expert фида, синхронизация каждые 30 мин |
| `news` | Новости: title, slug, content, image, `brand_id` (опциональная привязка к бренду) |
| `leads` | Заявки с сайта: тип, имя, телефон, авто, дата |
| `locations` | Дилерские центры: адрес, координаты (map_x=lat, map_y=lng) |
| `location_brands` | Привязка брендов к дилерским центрам |
| `reviews` | Отзывы (GetLoyalty): автор, рейтинг, текст, источник |
| `navigator_conversations` | Диалоги AI Навигатора по сессиям |
| `navigator_messages` | Сообщения диалогов: role, content, car_ids, rating |
| `settings` | Настройки сайта: key-value пары |
| `users` | Администраторы панели управления |

---

## Разработка

### Требования

- Node.js ≥ 18
- pnpm ≥ 9
- PostgreSQL ≥ 14

### Установка

```bash
# Клонирование
git clone https://github.com/skodabryansk-collab/debryansk-avto.git
cd debryansk-avto

# Установка зависимостей
pnpm install

# Миграции БД
pnpm --filter @workspace/db run migrate

# Запуск всех сервисов
pnpm run dev
```

### Переменные окружения

```env
# База данных
DATABASE_URL=postgresql://user:pass@host:5432/db

# API-сервер
PORT=8080

# SMTP (email-уведомления)
SMTP_HOST=smtp.timeweb.ru
SMTP_PORT=465
SMTP_USER=sales@debryansk-auto.ru
SMTP_PASS=...
SMTP_TO=sales@debryansk-auto.ru

# Внешние API
AUTORU_API_KEY=...            # Auto.ru dealer API
GETLOYALTY_API_KEY=...        # GetLoyalty (отзывы Яндекс/2ГИС)

# Google Cloud Storage
DEFAULT_OBJECT_STORAGE_BUCKET_ID=...
PRIVATE_OBJECT_DIR=...
PUBLIC_OBJECT_SEARCH_PATHS=...
```

---

<p align="center">
  <strong>Дебрянск Авто · Брянск, Россия</strong><br>
  <a href="https://debryansk-avto.ru">debryansk-avto.ru</a> ·
  <a href="tel:+74832777770">+7 (4832) 77 77 70</a>
</p>
