---
name: Catalog refactor approach (CarCard + FilterPanel)
description: Подход к рефакторингу /new-cars и /cars с вынесенными компонентами CarCard и FilterPanel — отложен, не понравился результат.
---

# Catalog refactor approach (CarCard + FilterPanel)

## Что было сделано

Полная переработка страниц `/new-cars` и `/cars` по ТЗ:

### Backend (API Server)
- `car_views` table: `car_id TEXT PK, view_count INT, updated_at TIMESTAMPTZ`
- `cars.popularity_score` column (ALTER TABLE IF NOT EXISTS — идемпотентный)
- `POST /api/cars/:id/view` → upsert в car_views + обновление popularity_score
- `GET /api/cars/new?sort=popularity|price_asc|price_desc|newest`
- `GET /api/cars/used?sort=popularity|...` — аналогично
- `getViewCounts(ids[])` — batch-helper для сортировки по просмотрам

### Frontend: компоненты
- **CarCard.tsx** — универсальная карточка (new+used), режимы grid/list, skeleton,
  badge (скидка>новинка>популярное), favorites, recordView (localStorage+API),
  sessionStorage-навигация (`catalog_scroll`, `catalog_from_detail`, `catalog_recently_viewed`)
- **FilterPanel.tsx** — desktop sticky sidebar + CSS bottom sheet (без motion/framer),
  экспортирует `FilterValues`, `DEFAULT_FILTER_VALUES`, `countActiveFilters`, `filterCars`;
  секции: availability, цена (radio+поля), пробег, кузов, привод, КПП, год, цвет;
  активные теги с поштучным удалением; URL-sync через history.replaceState

### Frontend: страницы
- **new-cars.tsx** — CarModelGroup (≥3 авто brand+model+year+modification, sessionStorage expand),
  RecentlyViewed, бренд-пилюли дилеров, sort select + grid/list toggle, URL↔filters, scroll restore,
  empty state с топ-популярными
- **cars.tsx** — аналог, showMileage/showYear=true, нет grouping, brand pills из XML mark

## Почему отложено

Пользователю не понравился результат («фигня»). Откат к версии до рефактора.

## Ключевые файлы (если возвращаться)

- `artifacts/api-server/src/routes/car-views.ts` — роут просмотров
- `artifacts/debryansk-avto/src/components/CarCard.tsx` — карточка
- `artifacts/debryansk-avto/src/components/FilterPanel.tsx` — панель фильтров

**Note:** car_views таблица и popularity_score колонка уже созданы в БД (миграция идемпотентна).
При возврате к этому подходу эти элементы уже будут на месте.
