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
- [Бонусная программа лояльности](#бонусная-программа-лояльности)
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
| **@codemirror** | Markdown-редактор новостей |

### Backend (`artifacts/api-server`)

| Технология | Назначение |
|---|---|
| **Express 5** | Веб-фреймворк |
| **TypeScript** | Строгая типизация |
| **Drizzle ORM** | Типобезопасные SQL-запросы |
| **PostgreSQL** | Хранение данных |
| **Puppeteer** | SSR/SSG (Server-Side Rendering / Static Site Generation) |
| **Nodemailer** | SMTP-отправка писем |

---

## Архитектура

Проект оформлен как **pnpm-монорепозиторий** с чётким разделением фронтенда, бэкенда и админки.

```
workspace/
├── artifacts/
│   ├── debryansk-avto/      # Публичный сайт (React + Vite + Tailwind)
│   ├── admin-panel/           # Административная панель (React + Vite)
│   ├── api-server/            # REST API (Express + Drizzle)
│   ├── mockup-sandbox/        # Canvas-компоненты (для превью на доске)
│   └── debryansk-presentation/ # Слайды для презентаций
├── packages/
│   ├── db/                    # Drizzle схема + миграции (shared)
│   ├── shared/                # Утилиты, типы (shared)
│   └── ui/                    # shadcn/ui компоненты (shared)
└── pnpm-workspace.yaml
```

Все приложения подключаются к единой PostgreSQL БД через пакет `@workspace/db`.

---

## Публичный сайт

### Основные разделы

| Раздел | URL | Описание |
|---|---|---|
| **Главная** | `/` | Hero, бренды, модели в наличии, отзывы, карта |
| **Каталог новых** | `/new-cars` | Каталог новых авто с фильтрами по бренду, модели, цене, кузову |
| **Каталог с пробегом** | `/cars` | Каталог б/у авто (CM Expert feed) |
| **Страница авто** | `/new-cars/:id`, `/cars/:id` | Детальная карточка: фото, характеристики, кредитный калькулятор |
| **Сервис** | `/service` | Техническое обслуживание: онлайн-запись, услуги, запчасти |
| **Бонусная программа** | `/service/bonus` | Программа лояльности для клиентов сервиса |
| **Выкуп** | `/buyout` | Оценка и выкуп автомобиля (3 шага формы) |
| **О компании** | `/about` | История, контакты, расположение на карте |
| **Контакты** | `/contacts` | Все контакты с картой и схемами проезда |
| **Новости** | `/news` | Блог автодилера, новости по брендам |
| **Вакансии** | `/vacancies` | Вакансии (интеграция с hh.ru) |
| **Юридическая информация** | `/legal` | Реквизиты, схемы проезда |
| **Политика конфиденциальности** | `/privacy` | Политика обработки данных |

### Главное меню (навигация)
- **Автомобили** — dropdown: Новые / С пробегом
- **Услуги** — dropdown: Сервис и ТО / Бонусная программа
- **О группе**, **Дилеры**, **Выкуп**, **Контакты**, **Бонусы**
- **Вакансии**, **Новости**, **Избранное**, **Сравнить**

### Общие компоненты
- **ChatWidget** — кнопка связи (вкладки: Звонок, WhatsApp, Telegram, VK)
- **LocationBar** — бар с адресом и графиком работы над шапкой
- **Compare / Favorites** — сравнение и избранное с localStorage
- **StickyHeader** — шапка с тенью при скролле, 1 rem (16 px) уменьшение

### Кредитный калькулятор
- Расчёт ежемесячного платежа по формуле аннуитета
- Гибкие настройки: первоначальный взнос, срок, ставка
- Предзаполнение данными из URL-параметров (utm, model, price)

---

## Бренд-страницы

### Структура
Каждый бренд имеет собственную страницу (например, `/brands/haval-pro`) с уникальным контентом:
- Hero-баннер с логотипом и слоганом бренда
- Описание бренда, преимущества, характерные черты
- Модельный ряд в наличии (фильтр по бренду)
- Техническое обслуживание и сервис
- Блок новостей по бренду
- Отзывы клиентов (GetLoyalty)
- Яндекс Карта с точками продаж/сервиса бренда
- FAQ по бренду (из таблицы `faqs`)

### SEO
- Уникальные meta-title, meta-description и H1 для каждого бренда
- JSON-LD `BreadcrumbList` и `FAQPage` для всех страниц
- Динамические OG-картинки, canonical URLs
- Prerender/SSG для ботов через middleware `seoMeta.ts`

### Каталог новых брендов
- OMODA: `/brands/omoda`
- JAECOO: `/brands/jaecoo`
- Haval City: `/brands/haval-city`
- Haval Pro: `/brands/haval-pro`
- Jetour: `/brands/jetour`
- Tenet: `/brands/tenet`
- EXEED: `/brands/exeed`
- Mercedes-Benz: `/brands/mercedes-benz`
- Volkswagen: `/brands/volkswagen`
- SKODA: `/brands/skoda`

---

## AI Навигатор

Интеллектуальный чат-помощник на главной странице.

### Функционал
- **Анализ запроса** клиента на естественном языке (GPT-5-mini)
- **Поиск по каталогу** — подбор авто по параметрам (цена, кузов, бренд)
- **Ответы на вопросы** о кредите, trade-in, гарантии, сервисе
- **Действия**: запись на ТО, запрос цены, связь с менеджером

### Техническая реализация
- Системный промпт с контекстом каталога (50 б/у + 60 новых авто)
- JSON-mode ответы: `{ reply, car_ids[], action }`
- Персистентность сообщений в `localStorage` (до 60 сообщений)
- Синхронизация каталога авто каждые 30 минут

---

## Бонусная программа лояльности

Программа лояльности для клиентов сервиса, действующая во всех 4 дилерских центрах группы компаний.

### Страница `/service/bonus`
- **Начисление**: 10% от суммы любого заказ-наряда (ТО, ремонт, запчасти, аксессуары)
- **Списание**: от 5% до 10% стоимости заказ-наряда в зависимости от накопительного уровня
- **Накопительные уровни** (6 штук): Базовый 5% → +50K → 6% → +100K → 7% → +150K → 8% → +200K → 9% → +250K → 10%
- **Фиксированные бонусы**: 10 000 (новый авто), 20 000 (повторная покупка), 5 000 (б/у новый клиент), 2 500 (приветственные), 4 000 (за 4 ТО), 1 000 (рекомендации), 5 000 (акция «Приведи друга»)
- **СБП-скидка**: дополнительные 5% при оплате через Систему быстрых платежей
- **Пример выгоды**: 15 000 ₽ заказ-наряд → +1 500 баллов → следующий визит уже 13 500 ₽
- **Ограничения**: списание не производится при кузовном ремонте и покупке шин/дисков
- **Срок действия**: баллы действуют 12 месяцев, при неактивности замораживаются на 6 месяцев

### Интеграция
- Главное меню: отдельная ссылка «Бонусы» с иконкой Gift
- Промо-баннер на странице `/service`
- BreadcrumbList JSON-LD: Главная → Сервис → Бонусная программа
- FAQ-блок на странице программы (таблица `faqs`)

---

## Административная панель

Полноценный back-office для управления контентом и данными.

### Разделы

| Раздел | Функционал |
|---|---|
| **Дашборд** | Графики по продажам, записям на сервис, выкупам |
| **Автомобили** | CRUD: добавление, редактирование, удаление, изменение статуса |
| **Записи на сервис** | Таблица заявок, фильтры по статусу, быстрое действие |
| **Заявки на выкуп** | Управление заявками, фильтрация, просмотр деталей |
| **Бренды** | CRUD брендов: название, slug, SEO-мета, контент, изображения |
| **Новости** | CRUD новостей: редактор Markdown, изображения, категории |
| **Вакансии** | CRUD вакансий: заголовок, описание, требования, зарплата |
| **FAQ** | CRUD вопросов-ответов по страницам (с JSON-LD флагом) |
| **Страницы контента** | SEO-контент для бренд-страниц (блоки: Описание, Преимущества, Модели, Сервис, Контакты) |
| **Локации** | CRUD дилерских центров: адреса, телефоны, часы работы, карты |
| **Отзывы** | Агрегированные отзывы с GetLoyalty (с фильтрами) |
| **Настройки сайта** | SEO-заголовки, телефоны, email, соцсети |
| **Навигатор (AI)** | Логи запросов к AI-чату, управление системным промптом |
| **Пользователи** | CRUD администраторов |

### Защита
- Авторизация по паролю (bcrypt)
- Protected routes (React Router guards)
- Logout + redirect на login

---

## API-сервер

### Endpoints

#### Автомобили
- `GET /api/cars` — список авто (фильтры: бренд, модель, тип, цена)
- `GET /api/cars/:id` — детали авто
- `GET /api/brands/:slug/cars` — авто по бренду

#### Записи на сервис
- `POST /api/service-bookings` — создание заявки
- `GET /api/service-bookings` — список (admin only)

#### Выкуп
- `POST /api/buyout-requests` — заявка на выкуп (3 шага)
- `GET /api/buyout-requests` — список (admin only)

#### Новости
- `GET /api/news` — список новостей
- `GET /api/news/:slug` — детальная новость
- `POST /api/news` — создание (admin only)

#### Вакансии
- `GET /api/vacancies` — список вакансий
- `POST /api/vacancies` — создание (admin only)

#### Отзывы
- `GET /api/reviews` — список отзывов (GetLoyalty)
- `GET /api/reviews/aggregate` — агрегированные данные (средний рейтинг, количество)

#### AI Навигатор
- `POST /api/chat` — чат с AI (GPT-5-mini)
- `GET /api/chat/logs` — логи запросов (admin only)

#### Настройки
- `GET /api/settings` — публичные настройки сайта
- `PUT /api/settings` — обновление настроек (admin only)

#### Email
- `POST /api/send-email` — отправка письма (callback, заявка, обратная связь)

### Middleware
- `seoMeta.ts` — Prerender для ботов (Puppeteer + кэширование)
- `botDetection.ts` — Определение User-Agent ботов
- `cacheControl.ts` — Настройки кэширования
- BreadcrumbList JSON-LD для всех страниц

---

## Внешние интеграции

### Auto.ru API
- Каталог марок и моделей (breadcrumbs)
- Проксирование через бэкенд (CORS-защита)
- Используется для валидации и подсказок в формах

### GetLoyalty
- Агрегация отзывов с Яндекс.Карт и 2ГИС
- Автоматическая дедупликация и фильтрация (4-5★, 90 дней)
- Защита от wrap-around пагинации (обнаружение дубликатов)
- Обновление каждые 30 минут

### hh.ru API
- Загрузка вакансий дилера
- Фильтрация по ключевым словам
- Кэширование на 1 час

### CM Expert
- Каталог автомобилей с пробегом
- Интеграция фида в БД (синхронизация)

### Google Cloud Storage (Object Storage)
- Хранение изображений авто, логотипов брендов, медиафайлов
- Публичный доступ через signed URLs

---

## Email-уведомления

### SMTP (Nodemailer)
- Отправка через провайдера с авторизацией
- HTML-шаблоны для разных типов писем

### Типы писем
- **Callback** — заявка на обратный звонок
- **Service Booking** — запись на ТО/сервис
- **Buyout Request** — заявка на выкуп (3 шага)
- **Contact Form** — обратная связь

---

## SEO и производительность

### Технические решения
- **SSG** (Static Site Generation) — все маршруты предгенерируются в HTML
- **Prerender** для ботов — Puppeteer + User-Agent detection
- **JSON-LD** schema.org: FAQPage, NewsArticle, BreadcrumbList, LocalBusiness, AutoDealer
- **Lazy loading** изображений (`loading="lazy"`, `decoding="async"`)
- **WebP-оптимизация** — конвертация PNG/JPG (~95% уменьшение размера)
- **SVG-оптимизация** — ручная чистка, группировка по fill
- **Image srcset** для адаптивных hero-баннеров

### Core Web Vitals (SEO Audit)
- **Lighthouse score**: ~79/100 (7 раундов аудита)
- Исправлены: canonical URLs, meta tags, OG/Twitter cards, alt-тексты
- Осталось: thin content (новостные статьи), author byline, orphan links, LCP preload

### Кэширование
- `staleTime` для React Query (5-60 минут в зависимости от эндпоинта)
- Prerender-кэш в памяти (`ssgCache`)
- Browser cache headers через middleware

---

## Структура проекта

```
debryansk-avto/
├── artifacts/
│   ├── debryansk-avto/
│   │   ├── src/
│   │   │   ├── pages/              # Страницы (home, cars, brands, service, bonus-program, buyout, about, contacts, news, vacancies, legal, privacy)
│   │   │   ├── components/         # Layout, SEO, ChatWidget, FaqBlock, ComparePanel, FavoritesPanel
│   │   │   ├── hooks/              # usePhoneMask, useCarStorage, useToast
│   │   │   ├── lib/                # normalizePhone, utils
│   │   │   ├── assets/             # Логотипы, изображения, иконки
│   │   │   └── App.tsx             # Роутинг (wouter)
│   │   ├── scripts/
│   │   │   └── ssg.mjs             # Скрипт статической генерации
│   │   ├── public/                 # Статика (robots.txt, sitemap, og-image)
│   │   └── vite.config.ts          # Конфигурация Vite
│   │
│   ├── admin-panel/
│   │   ├── src/
│   │   │   ├── pages/              # Дашборд, Автомобили, Записи, Выкуп, Бренды, Новости, Вакансии, FAQ, Настройки, AI-логи, Локации, Отзывы, Пользователи
│   │   │   ├── components/         # ui (shared shadcn)
│   │   │   ├── hooks/              # useAuth, useApi
│   │   │   └── App.tsx             # Роутинг
│   │   └── vite.config.ts
│   │
│   └── api-server/
│       ├── src/
│       │   ├── middleware/         # seoMeta.ts, botDetection.ts, cacheControl.ts
│       │   ├── routes/             # cars, brands, news, vacancies, buyout, service-bookings, reviews, chat, settings
│       │   ├── lib/                # logger.ts, db.ts
│       │   └── app.ts              # Express приложение
│       └── migration.ts            # Drizzle миграции
│
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema.ts           # Drizzle schema (cars, brands, news, vacancies, locations, settings, faqs, chat_logs)
│   │   │   └── index.ts            # Экспорт db-коннекшена
│   │   └── drizzle.config.ts
│   │
│   ├── shared/
│   │   └── src/
│   │       └── index.ts            # Общие типы и утилиты
│   │
│   └── ui/
│       └── src/
│           └── components/         # shadcn/ui компоненты (Button, Input, Dialog, Accordion, etc.)
│
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions (CI/CD)
│
├── .local/
│   └── skills/                     # Кастомные скилы для Replit Agent
│       └── auto-track-and-sync/
│           └── SKILL.md            # Автоматическая синхронизация с GitHub
│
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## Разработка

### Установка
```bash
pnpm install
```

### Запуск dev-серверов
```bash
# Публичный сайт
pnpm --filter @workspace/debryansk-avto run dev

# API-сервер
pnpm --filter @workspace/api-server run dev

# Админ-панель
pnpm --filter @workspace/admin-panel run dev
```

### Сборка
```bash
# Публичный сайт (с SSG)
pnpm --filter @workspace/debryansk-avto run build

# API-сервер
pnpm --filter @workspace/api-server run build
```

### Миграции БД
```bash
pnpm --filter @workspace/api-server run migrate
```

### Статическая генерация (SSG)
```bash
pnpm --filter @workspace/debryansk-avto run build
# SSG-скрипт (ssg.mjs) генерирует HTML для всех маршрутов:
# /, /new-cars, /cars, /service, /service/bonus, /buyout, /about, /contacts, /news, /vacancies, /privacy, /legal
# + динамические: /brands/:slug, /news/:slug, /new-cars/:id, /cars/:id
```

### Переменные окружения
- `DATABASE_URL` — PostgreSQL connection string
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — SMTP-конфиг
- `AUTORU_API_KEY` — Auto.ru API
- `GETLOYALTY_API_KEY` — GetLoyalty API
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` — GCS bucket
- `FRONTEND_DIST_PATH` — путь до dist (для API-сервера)

---

## Лицензия

Внутренний проект ООО «Дебрянск Авто» (группа компаний 9 БР).
