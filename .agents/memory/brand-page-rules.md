---
name: Brand page rules
description: Правила создания и редактирования страниц брендов (brand-page.tsx) — структура, данные, компоненты, особые случаи.
---

# Правила создания бренд-страниц

**Why:** Бренд-страницы имеют сложную структуру с несколькими источниками данных, специальными логотипами (HAVAL_CATALOG), картой и новостями. Без этих правил легко что-то пропустить или сломать существующую логику.

## Роут
- URL: `/brands/:slug` (в App.tsx)
- Компонент: `artifacts/debryansk-avto/src/pages/brand-page.tsx`
- API: `GET /api/brands/:slug` → `artifacts/api-server/src/routes/public-brands.ts`

## Структура данных API (`BrandPageData`)
```
brand      — id, name, slug, logoUrl, bgColor, subName, isServiceOnly
content    — description, serviceText, promoText, metaTitle, metaDescription
locations  — [{id, title, address, phone, hours, map_x, map_y, is_service}]
cars       — [{id, mark, model, price, images[], dealer, max_discount, ...}]
news       — [{id, title, excerpt, category, image, published_at, slug}]
```

## Секции страницы (по порядку)
1. **Hero** — логотип бренда, кнопки (Тест-драйв, Заказать звонок, Сайт бренда)
2. **О бренде** (`#section-about`) — description из content
3. **Модельный ряд** (`#section-models`) — HAVAL: статичный каталог HAVAL_CATALOG; остальные: dynamicModels из cars
4. **В наличии** (`#section-stock`) — featuredCars (до 6, сначала со скидкой)
5. **Сервис** (`#section-service`) — serviceText, 3 иконки, кнопка записи на ТО
6. **Новости** (`#section-news`) — только если `data.news.length > 0`, до 4 карточек
7. **Контакты** (`#section-contacts`) — YandexMap + info card с адресом/телефоном/часами

## Карта в контактах
- Компонент: `YandexMap` из `@/components/YandexMap`
- `loc = locations[0]` — первая локация бренда
- `lat = loc.map_x`, `lng = loc.map_y` (map_x = широта ≈53.x, map_y = долгота ≈34.x)
- Высота контейнера: `h-[280px]`, rounded-2xl, mb-6
- Показывается только если `loc.map_x && loc.map_y`
- DealerLocation: `{ id, address, short: loc.title, brands: [brandName], lat, lng, color: "#0070b8", phone, hours }`

## HAVAL — особый случай
- Слаги: `HAVAL_SLUGS = ["haval-city", "haval-pro"]`
- Используют статичный каталог `HAVAL_CATALOG` (8 моделей) вместо API
- Некоторые модели имеют `noBrand: true` (Poer — продаётся без бренда GWM)
- `cleanModelName` убирает поколение: `/,\s*[IVX]+.*$/` (включая Рестайлинг)

## Новости
- Секция рендерится только если `data.news && data.news.length > 0`
- API возвращает до 4 новостей: сначала по `brand_id`, затем по text-match в title/excerpt
- `brand_id` — опциональная привязка в таблице `news` (integer, nullable)
- Для привязки: в админке → Новости → редактировать → выбрать бренд внизу формы

## Автонавигация (sticky nav)
- Навигатор-якоря: `#section-about`, `#section-models`, `#section-stock`, `#section-service`, `#section-news`, `#section-contacts`
- `scroll-mt-24` на каждой секции для offset от sticky header

## Ключевые утилиты
- `SectionLabel` — зелёный uppercase лейбл над заголовком секции
- `FadeIn` — анимация появления (motion.div)
- `normalizePhone` / `phoneHref` из `@/lib/normalizePhone`
- `mapLink` = `https://yandex.ru/maps/?ll=${lng},${lat}&pt=${lng},${lat}&z=16` (сначала lng, потом lat!)

## Добавление нового бренда
1. Добавить в таблицу `brands` (name, slug, logoUrl, bgColor)
2. Привязать к локации в `location_brands`
3. Если нужен статичный каталог — добавить slug в `HAVAL_SLUGS` и данные в аналогичный массив
4. Контент (`description`, `serviceText`) — через админку → Бренды → Контент страницы
