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
    <img src="https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai" alt="OpenAI">
    <img src="https://img.shields.io/badge/pnpm-monorepo-F69220?logo=pnpm" alt="pnpm">
  </p>

  ---

  ## Содержание

  - [О проекте](#о-проекте)
  - [Технологический стек](#технологический-стек)
  - [Архитектура](#архитектура)
  - [Навигатор — ИИ-консультант](#навигатор--ии-консультант)
  - [Публичный сайт](#публичный-сайт)
  - [Административная панель](#административная-панель)
  - [API-сервер](#api-сервер)
  - [Каталог авто и синхронизация](#каталог-авто-и-синхронизация)
  - [Внешние интеграции](#внешние-интеграции)
  - [Email-уведомления](#email-уведомления)
  - [SEO и производительность](#seo-и-производительность)
  - [Структура проекта](#структура-проекта)
  - [Разработка](#разработка)

  ---

  ## О проекте

  **Дебрянск Авто** — полнофункциональный веб-портал мультибрендовой дилерской группы «Территория Автомобилей», расположенной в Брянске. Включает публичный сайт для покупателей, полноценную административную панель, REST API-сервер и встроенного ИИ-консультанта **Навигатор**.

  ### Представленные бренды
  - **Новые автомобили**: OMODA, JAECOO, Haval (City / Pro), Jetour, Tenet, EXEED
  - **Сервисное обслуживание**: Volkswagen, Mercedes-Benz, Skoda и другие
  - **Автомобили с пробегом**: все марки (Lada, Hyundai, Kia, BMW, Audi, Toyota и др.)

  ---

  ## Технологический стек

  ### Frontend (`artifacts/debryansk-avto`)

  | Технология | Назначение |
  |---|---|
  | **React 19** | UI-фреймворк |
  | **Vite 7** | Сборка и dev-сервер |
  | **TypeScript** | Строгая типизация |
  | **Tailwind CSS 4** | Utility-first стилизация |
  | **wouter** | Лёгкий клиентский роутинг (1.5 KB) |
  | **@tanstack/react-query** | Серверное состояние, кэширование |
  | **react-helmet-async** | Динамические SEO meta-теги |
  | **framer-motion** | Анимации и переходы |
  | **lucide-react** | Иконки |
  | **react-leaflet** | Интерактивные карты |
  | **shadcn/ui** | UI-компоненты |

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
  | **OpenAI GPT-4o-mini** | ИИ-движок чат-бота Навигатор |
  | **Nodemailer** | Отправка email-уведомлений |
  | **multer** | Обработка загрузок файлов |
  | **esbuild** | Сборка сервера |

  ---

  ## Архитектура

  ```
  workspace/ (pnpm monorepo)
  ├── artifacts/
  │   ├── debryansk-avto/      → Публичный сайт (React SPA)
  │   ├── admin-panel/         → Административная панель (React SPA)
  │   ├── api-server/          → REST API + email + интеграции + ИИ (Express)
  │   └── mockup-sandbox/      → Изолированная среда для UI-прототипов
  │
  ├── lib/
  │   ├── db/                  → Drizzle схема + миграции (PostgreSQL)
  │   └── api-zod/             → Zod-схемы, общие типы
  │
  └── scripts/                 → Утилиты импорта данных
  ```

  ### Поток данных

  ```
  CM Expert XML-фид → car-sync (каждые 30 мин) → PostgreSQL cars
  CM Expert XML-фид → api-server (in-memory cache) → /api/cars/*
  Auto.ru API → api-server → /api/car-catalog/cm-*
  hh.ru RSS/API → api-server → /api/hh-vacancies
  Формы → POST /api/send-email → SMTP + leads_table
  Медиафайлы → multer → Google Cloud Storage → публичные URL
  Чат-сообщения → /api/chat → OpenAI + каталог из PostgreSQL → ответ + карточки авто
  ```

  ---

  ## Навигатор — ИИ-консультант

  «**Навигатор**» — встроенный чат-бот на базе GPT-4o-mini, доступный на всех страницах сайта в виде плавающей кнопки.

  ### Возможности

  | Функция | Описание |
  |---|---|
  | **Подбор авто** | Фильтрация по бюджету, марке, типу кузова, КПП, приводу, пробегу, числу владельцев |
  | **Скидки** | Бот видит актуальные скидки из фида (max, кредитная, trade-in) и сообщает о них |
  | **Карточки авто** | До 3 карточек с фото, ценой («от X ₽» для новых), бейджем скидки |
  | **Trade-in / Выкуп** | Inline-форма оценки через CM Expert прямо в чате |
  | **Тест-драйв** | Inline-форма записи с выбором модели и времени |
  | **Сервис** | Inline-форма записи на ТО, ремонт, диагностику |
  | **Обратный звонок** | Inline-форма имя + телефон |
  | **История диалога** | Сохраняется в localStorage, контекст передаётся в LLM |
  | **Оценки ответов** | 👍 / 👎 для каждого сообщения, хранятся в БД |

  ### Технические детали

  - **Модель**: OpenAI GPT-4o-mini (через Replit AI Integrations proxy)
  - **Контекст**: весь сток (до 1000 авто) в каждом запросе (~56k символов), адреса дилеров, бренды, акции
  - **Синхронизация**: `syncCars()` при старте сервера и каждые 30 минут; скидки сохраняются в БД
  - **Фильтрация сортировки**: релевантные авто всплывают первыми (brand/body_type/price)
  - **Парсинг тегов**: `[[CARS:id1,id2]]` → карточки авто; `[[ACTION:тип]]` → inline-форма
  - **База**: таблицы `conversations`, `messages` (role, content, car_ids, rating)

  ### Типы кузова (распознаются в запросах)

  `Внедорожник`, `Седан`, `Хэтчбек`, `Универсал`, `Лифтбек`, `Пикап`, `Минивэн`  
  Ключевые слова: «кроссовер», «внедорожник», «джип», «седан», «хэтч», «универсал», «пикап», «минивэн» и их словоформы.

  ---

  ## Публичный сайт

  ### Страницы

  | Путь | Описание |
  |---|---|
  | `/` | Главная: hero-баннер, бренды, карусели авто, новости, карта дилеров |
  | `/new-cars` | Каталог новых авто с фильтрами, скидками и сортировкой |
  | `/new-cars/:id` | Карточка нового авто: фото, характеристики, комплектация, скидки |
  | `/cars` | Каталог авто с пробегом |
  | `/cars/:id` | Карточка б/у авто: фото, VIN, история владельцев |
  | `/buyout` | Выкуп авто: многошаговая форма с онлайн-оценкой CM Expert |
  | `/compare` | Сравнение до 3 авто по характеристикам и опциям |
  | `/favorites` | Избранные авто (localStorage) |
  | `/service` | Сервисный центр: услуги, онлайн-запись |
  | `/news` | Новости и статьи |
  | `/news/:slug` | Детальная страница новости с SEO и JSON-LD |
  | `/vacancies` | Вакансии (hh.ru + ручные позиции) |
  | `/about` | О компании |
  | `/contacts` | Контакты: 4 дилерских центра с картами |
  | `/privacy` | Политика конфиденциальности |

  ### Lead-формы

  | Тип | Способ открытия |
  |---|---|
  | Заказать звонок | Хедер, карточки авто |
  | Тест-драйв | Карточка нового авто, чат-бот |
  | Кредитный калькулятор | Карточки авто |
  | Trade-in | Карточки авто, чат-бот (inline) |
  | Выкуп | Страница `/buyout`, чат-бот (inline) |
  | Запись на сервис | Страница `/service`, чат-бот (inline) |
  | Отклик на вакансию | Страница `/vacancies` |
  | Обратная связь | Страница `/contacts`, чат-бот (inline) |

  ---

  ## Административная панель

  Back-office на `/admin-panel`:

  | Раздел | Функционал |
  |---|---|
  | **Дашборд** | Статистика заявок, новостей, состояние системы |
  | **Заявки (Leads)** | Все обращения с сайта: тип, имя, телефон, авто, дата |
  | **Навигатор** | История чатов, оценки ответов, ручной запуск синхронизации авто |
  | **Бренды** | CRUD: название, логотип, активность, только-сервис |
  | **Локации** | Дилерские центры: адрес, телефон, часы, привязка к бренду |
  | **Новости** | CRUD: заголовок, slug, содержание, фото, публикация |
  | **Настройки сайта** | SEO, контакты, телефоны, текст акций (для Навигатора) |
  | **Пользователи** | Управление доступом к панели |

  ---

  ## API-сервер

  ### Публичные эндпойнты

  | Метод | Путь | Описание |
  |---|---|---|
  | GET | `/api/cars/used` | Авто с пробегом из XML-фида |
  | GET | `/api/cars/new` | Новые авто из XML-фидов (6 дилеров) |
  | GET | `/api/cars/featured` | Избранные авто для главной |
  | GET | `/api/news` | Список новостей |
  | GET | `/api/news/:slug` | Новость по slug |
  | GET | `/api/brands` | Список брендов |
  | GET | `/api/locations` | Дилерские центры |
  | GET | `/api/settings` | Настройки сайта |
  | GET | `/api/hh-vacancies` | Вакансии с hh.ru |
  | POST | `/api/send-email` | Отправка заявок + сохранение лида |
  | POST | `/api/chat` | ИИ-чат Навигатор |

  ### CM Expert эндпойнты

  | Метод | Путь | Описание |
  |---|---|---|
  | GET | `/api/car-catalog/cm-brands` | Марки |
  | GET | `/api/car-catalog/cm-models` | Модели по марке |
  | GET | `/api/car-catalog/cm-generations` | Поколения |
  | GET | `/api/car-catalog/cm-expert-predict` | Онлайн-оценка выкупной стоимости |

  ### Административные эндпойнты

  | Метод | Путь | Описание |
  |---|---|---|
  | CRUD | `/api/admin/leads` | Заявки |
  | CRUD | `/api/admin/brands` | Бренды |
  | CRUD | `/api/admin/locations` | Локации |
  | CRUD | `/api/admin/news` | Новости |
  | CRUD | `/api/admin/settings` | Настройки |
  | POST | `/api/admin/upload` | Загрузка изображений в GCS |
  | POST | `/api/admin/navigator/sync-cars` | Ручной запуск синхронизации авто |
  | GET | `/api/admin/navigator/conversations` | История чатов Навигатора |

  ---

  ## Каталог авто и синхронизация

  Авто хранятся в таблице `cars` PostgreSQL и синхронизируются из XML-фидов CM Expert.

  ### Таблица `cars`

  | Поле | Описание |
  |---|---|
  | `external_id` | Уникальный ID из фида |
  | `type` | `new` / `used` |
  | `brand`, `model`, `year` | Марка, модель, год |
  | `color`, `body_type` | Цвет, тип кузова |
  | `price` | Цена в рублях |
  | `mileage` | Пробег (км) |
  | `modification` | Двигатель + КПП + привод (напр. `1.5 AMT 4WD`) |
  | `complectation`, `extras` | Комплектация и опции |
  | `owners_number` | Число владельцев |
  | `max_discount` | Максимальная скидка (₽) |
  | `credit_discount` | Скидка при кредите (₽) |
  | `tradein_discount` | Скидка при trade-in (₽) |
  | `image_url` | Первое фото |
  | `dealer` | Дилер (для новых авто) |

  ### Синхронизация

  - Запускается автоматически при старте API-сервера
  - Повторяется каждые 30 минут через setInterval
  - Ручной запуск: `POST /api/admin/navigator/sync-cars`
  - Фиды: 1 фид б/у авто + 6 фидов новых авто (по дилерам)

  ---

  ## Внешние интеграции

  | Сервис | Назначение | Статус |
  |---|---|---|
  | **CM Expert** | XML-фиды авто, оценка стоимости, справочник марок/моделей | ✅ |
  | **OpenAI API** | GPT-4o-mini для чат-бота Навигатор | ✅ |
  | **Auto.ru API** | Дополнительный справочник брендов/моделей | ✅ |
  | **hh.ru** | Синхронизация вакансий (RSS + API) | ✅ |
  | **SMTP (Timeweb)** | Email-уведомления о заявках | ✅ |
  | **Google Cloud Storage** | Хранение изображений из админки | ✅ |
  | **Leaflet / 2GIS** | Интерактивная карта дилеров | ✅ |

  ---

  ## Email-уведомления

  При каждой заявке отправляется HTML-письмо на `sales@debryansk-auto.ru`. Все заявки сохраняются в таблице `leads`.

  | Тип | Тема |
  |---|---|
  | `callback` | 📞 Заказать звонок |
  | `testdrive` | 🏁 Тест-драйв |
  | `credit` | 💳 Автокредит |
  | `tradein` | 🔄 Trade-in (с оценкой CM Expert) |
  | `buyout` | 💰 Выкуп автомобиля |
  | `service` | 🔧 Запись на сервис |
  | `vacancy` | 💼 Отклик на вакансию |
  | `feedback` | ✉️ Обратная связь |

  ---

  ## SEO и производительность

  | Оптимизация | Детали |
  |---|---|
  | **Schema.org JSON-LD** | AutoDealer, Car/Vehicle, ItemList, BreadcrumbList, NewsArticle, Service |
  | **Open Graph + Twitter Cards** | На каждой странице с og:image |
  | **Canonical URLs** | Предотвращение дублирования |
  | **Sitemap** | Авто-генерация для новостей и авто |
  | **WebP-изображения** | Конвертация PNG/JPG → WebP (~95% экономия трафика) |
  | **Lazy loading** | Все изображения вне hero |
  | **Адаптивный hero** | `<picture>` + srcset для mobile/desktop |
  | **React Query кэш** | staleTime 5 мин для каталога и справочников |

  ---

  ## Структура проекта

  ```
  artifacts/debryansk-avto/src/
  ├── components/
  │   ├── ChatWidget.tsx        # ИИ-чат Навигатор (inline-формы, карточки авто)
  │   ├── Layout.tsx            # Общий лэйаут (хедер + футер)
  │   ├── CarCard.tsx           # Карточка авто в каталоге
  │   ├── FilterPanel.tsx       # Панель фильтров каталога
  │   └── forms/                # Lead-формы (trade-in, testdrive, callback…)
  └── pages/
      ├── home.tsx              # Главная (свой хедер, без Layout)
      ├── new-cars.tsx          # Каталог новых авто
      ├── cars.tsx              # Каталог б/у авто
      ├── car-detail.tsx        # Карточка авто
      ├── buyout.tsx            # Выкуп (CM Expert оценка)
      ├── service.tsx           # Сервис
      └── ...

  artifacts/api-server/src/
  ├── routes/
  │   ├── chat.ts              # Навигатор: промпт, buildContext, buildCarCatalog
  │   ├── cars.ts              # XML-фид б/у авто
  │   ├── new-cars.ts          # XML-фиды новых авто (6 дилеров)
  │   ├── car-catalog.ts       # CM Expert API (оценка, справочник)
  │   ├── email.ts             # Отправка заявок + HTML-шаблоны
  │   └── admin-navigator.ts   # Управление чатами и синк авто
  └── services/
      └── car-sync.ts          # Синхронизация XML → PostgreSQL
  ```

  ---

  ## Разработка

  ```bash
  # Установка зависимостей
  pnpm install

  # Запуск всех сервисов
  pnpm --filter @workspace/debryansk-avto run dev   # Сайт (PORT из env)
  pnpm --filter @workspace/api-server run dev       # API (порт 8080)
  pnpm --filter @workspace/admin-panel run dev      # Админка

  # Проверка типов
  pnpm run typecheck

  # Сборка
  pnpm run build
  ```

  ### Переменные окружения

  | Переменная | Описание |
  |---|---|
  | `DATABASE_URL` | PostgreSQL connection string |
  | `AUTORU_API_KEY` | Токен Auto.ru Dealer API |
  | `SMTP_PASS` | Пароль SMTP (Timeweb) |
  | `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Бакет Google Cloud Storage |
  | `PRIVATE_OBJECT_DIR` | Приватная директория объектного хранилища |
  | `PUBLIC_OBJECT_SEARCH_PATHS` | Публичные пути для GCS |

  ---

  ## Архитектурные решения

  - **Главная страница имеет собственный хедер** — `home.tsx` содержит встроенный `<header>` с анимацией логотипа, не использует `Layout.tsx`. При изменении навигации обновлять оба файла.
  - **Роутер Express без префикса** — пути в `router.get(...)` пишутся БЕЗ `/api` (он добавлен через `app.use("/api", router)`).
  - **multer и nodemailer** — должны быть в `external` в esbuild конфиге.
  - **Навигатор — catalog in user turn** — каталог авто передаётся в пользовательском сообщении, а не в system prompt (обход ограничений Replit proxy).
  - **Двойной кэш каталога** — строки для бота кэшируются 30 мин; `dbRowsCache` хранит сырые строки БД; `catalogTextCache` хранит готовый текст для LLM.
  - **Скидки из XML** — поля `max_discount`, `credit_discount`, `tradein_discount` синхронизируются при каждом синке и передаются боту в контексте.
  