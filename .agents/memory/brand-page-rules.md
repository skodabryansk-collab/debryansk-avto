---
name: Brand page rules
description: Правила создания и редактирования страниц брендов (brand-page.tsx) — структура, данные, компоненты, CMS-модели, особые случаи.
---

# Правила создания бренд-страниц

**Why:** Бренд-страницы имеют сложную структуру с несколькими источниками данных, CMS-управляемым модельным рядом, картой и новостями. Без этих правил легко что-то пропустить или сломать существующую логику.

## Роут
- URL: `/brands/:slug` (в App.tsx)
- Компонент: `artifacts/debryansk-avto/src/pages/brand-page.tsx`
- API: `GET /api/brands/:slug` → `artifacts/api-server/src/routes/public-brands.ts`

## Структура данных API (`BrandPageData`)
```
brand      — id, name, slug, logoUrl, bgColor, subName, isServiceOnly
content    — description, serviceText, promoText, metaTitle, metaDescription,
             heroImageUrl, heroImageMobileUrl, faq[], promotions[], models[]
locations  — [{id, title, address, phone, hours, map_x, map_y, is_service}]
cars       — [{id, mark, model, price, images[], dealer, max_discount, ...}]
news       — [{id, title, excerpt, category, image, published_at, slug}]
```

## Секции страницы (по порядку)
1. **Hero** — логотип бренда, кнопки (Тест-драйв, Заказать звонок, Сайт бренда)
2. **AnchorNav** (sticky) — показывает только активные секции
3. **О бренде** (`#section-about`) — description из content; скрыта если нет description
4. **Модельный ряд** (`#section-models`) — **только CMS-модели**; скрыта если нет активных CMS-моделей
5. **В наличии** (`#section-stock`) — featuredCars (до 6, сначала со скидкой); всегда рендерится
6. **Акции** (`#section-promotions`) — скрыта если нет активных акций
7. **Сервис** (`#section-service`) — serviceText, 3 иконки, кнопка записи на ТО; всегда
8. **FAQ** — скрыта если нет опубликованных вопросов
9. **Новости** (`#section-news`) — скрыта если `data.news.length === 0`
10. **Контакты** (`#section-contacts`) — YandexMap + info card

## Модельный ряд — CMS-управляемые модели

### Тип `BrandModel`
```ts
{
  id?: string;
  feedDealer: string;   // точное имя dealer из таблицы cars (для фильтрации)
  feedModel: string;    // точное имя model из таблицы cars (для фильтрации)
  displayName: string;  // отображаемое название (напр. "Jolion", "F7x")
  image?: string;       // URL изображения (PNG с прозрачным фоном)
  description?: string;
  badge?: string;       // напр. "Новинка", "Хит продаж"
  isActive?: boolean;   // default: true; false → не показывается на сайте
  sort?: number;        // порядок отображения
}
```

### Ключевые правила:
- `cmsModels` и `hasCmsModels` **объявляются ДО** `modelsWithPrice` — иначе TDZ ошибка
- Если `hasCmsModels === false` → секция «Модельный ряд» полностью скрыта (`{hasCmsModels && <section>}`)
- **Нет fallback к фиду**: `uniqueModels` возвращает `[]` когда CMS пуст
- Минимальная цена вычисляется **на клиенте** из массива `cars`, полученного от API
- Клик по ModelCard ведёт в `/new-cars?dealer=<feedDealer>&model=<feedModel>`
- `cleanModelName(model)` при матчинге: убирает поколение `/,\s*[IVX]+.*$/`

### Хранение в БД
- Таблица: `brand_page_content`, колонка `models JSONB DEFAULT '[]'`
- Drizzle schema: `lib/db/src/schema/brands.ts`
- Миграция идемпотентна: `ADD COLUMN IF NOT EXISTS models JSONB DEFAULT '[]'`

### Порядок объявления переменных в компоненте (важно!)
```ts
const cmsModels = (content?.models ?? []).filter(m => m.isActive !== false);
const hasCmsModels = cmsModels.length > 0;
// ... затем publishedFaq, faqPage, modelsWithPrice, modelsItemList, jsonLd ...
const uniqueModels = hasCmsModels ? [...cmsModels].sort(...).map(...) : [];
```

## Admin API — модели

### Для AdminUI (защищённые)
- `GET /api/admin/brand-pages/:brandId/catalog-models` — уникальные dealer+model из `cars` для данного бренда (для dropdown выбора модели из фида)
- `PUT /api/admin/brand-pages/:brandId` — сохраняет всё содержимое страницы, включая `models[]`

### Публичный API
- `GET /api/brands/:slug` — возвращает `content` через spread `rawContent`, то есть поле `models` включается автоматически

## Admin UI — редактор моделей (`ModelEditor` в brands.tsx)

- Компонент: `function ModelEditor` в `artifacts/admin-panel/src/pages/brands.tsx`
- Функции: добавить/удалить, сортировка кнопками ▲▼, переключатель isActive, поле поиска по каталогу, badge, description, загрузка фото
- Поиск по каталогу: `catalogSearch` — state-переменная, фильтрует `<select>` в реальном времени
- При выборе из dropdown автозаполняется `feedDealer` + `feedModel` + `displayName` (если пусто)
- Данные каталога: `getBrandCatalogModels(brandId)` → `GET /api/admin/brand-pages/:brandId/catalog-models`
- SQL в catalog-models: `REGEXP_REPLACE(model, ',\s*[IVX]+.*$', '')` — нормализует имена моделей (убирает поколение)

## JSON-LD для моделей
- Генерируется `ItemList` + `ListItem` + `Product` + `Offer` только для активных CMS-моделей с ценой в наличии
- `priceCurrency: "RUB"`, `availability: "https://schema.org/InStock"`
- Вычисляется через `modelsWithPrice` (CMS-модели у которых есть matching cars)
- Тип `jsonLdItems`: `Record<string, unknown>[]` (не `object[]` — иначе TS ошибка с SEO компонентом)

## Карта в контактах
- Компонент: `YandexMap` из `@/components/YandexMap`
- `loc = locations[0]` — первая локация бренда
- `lat = loc.map_x`, `lng = loc.map_y` (map_x = широта ≈53.x, map_y = долгота ≈34.x)
- Высота контейнера: `h-[280px]`, rounded-2xl, mb-6
- Показывается только если `loc.map_x && loc.map_y`
- DealerLocation: `{ id, address, short: loc.title, brands: [brandName], lat, lng, color: "#0070b8", phone, hours }`
- `mapLink` = `https://yandex.ru/maps/?ll=${lng},${lat}&pt=${lng},${lat}&z=16` (сначала lng, потом lat!)

## Новости
- Секция рендерится только если `data.news && data.news.length > 0`
- API возвращает до 4 новостей: сначала по `brand_id`, затем по text-match в title/excerpt
- `brand_id` — опциональная привязка в таблице `news` (integer, nullable)
- Для привязки: в админке → Новости → редактировать → выбрать бренд внизу формы

## Добавление нового бренда
1. Добавить в таблицу `brands` (name, slug, logoUrl, bgColor)
2. Привязать к локации в `location_brands`
3. Контент (`description`, `serviceText`, `models[]`) — через AdminUI → Бренды → Контент страницы
4. Для моделей: в диалоге редактирования бренда → секция «Модельный ряд» → добавить модели с привязкой к фиду

## Удалённое (больше не используется)
- `HAVAL_CATALOG`, `HAVAL_SLUGS`, `getModelPhotoFromCars` — удалены, заменены CMS-моделями
- Статичные каталоги в коде — больше не применяются, всё через AdminUI

## Данные моделей в dev и production
**Правило:** при исчезновении модельного ряда сначала сравнить `brand_page_content.models` в dev и ответ опубликованного `/api/brands/:slug`. Отсутствие моделей в dev не доказывает ошибку компонента или потерю данных в production.

**Why:** CMS-данные окружений независимы: dev-превью скрывало секцию из-за пустых массивов, тогда как опубликованный API сохранял настроенные модели. Относительные `/api/storage/objects/...` изображения из production также могут отвечать 404 в dev.

**How to apply:** восстанавливать только отсутствующие модели, не перезаписывая непустые dev-настройки; перед переносом проверять доступность изображений и использовать доступный публичный URL либо переносить сами файлы.
