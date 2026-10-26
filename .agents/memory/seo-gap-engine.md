---
name: SEO GAP Engine
description: Полная архитектура SEO-центра — GAP анализ, оценщик (Karpathy Loop), Автопилот, схема БД и правила доработки.
---

## Файлы системы

| Назначение | Путь |
|---|---|
| GAP-движок | `artifacts/api-server/src/services/seo-gap.ts` |
| Оценщик (Karpathy Loop) | `artifacts/api-server/src/services/seo-evaluator.ts` |
| Роут Автопилота | `artifacts/api-server/src/routes/admin-seo-autopilot.ts` |
| UI Автопилота | `artifacts/admin-panel/src/pages/seo-autopilot.tsx` |
| UI SEO Hub | `artifacts/admin-panel/src/pages/seo-hub.tsx` |
| UI позиций | `artifacts/admin-panel/src/pages/seo-positions.tsx` |

---

## Таблицы БД (SEO-центр)

| Таблица | Назначение |
|---|---|
| `seo_suggestions` | Все предложения GAP; unique `(type, page_url)` |
| `seo_query_snapshots` | Данные Яндекс Вебмастера; unique `(query_text, snapshot_date)` |
| `seo_anchor_queries` | Вручную заданные приоритетные запросы с target_position |
| `wordstat_snapshots` | Данные Яндекс Wordstat; unique `(query, snapshot_date, source)` |
| `gap_runs` | Лог запусков GAP (status, duration, suggestions_created) |
| `faqs` | FAQ-блоки на страницах бренда; поле `page_slug = 'brands/:slug'` |

### Ключевые колонки `seo_suggestions`
`type`, `page_url`, `current_value`, `proposed_value`, `reasoning`,
`priority_score`, `demand`, `position_factor`, `ease`, `status`,
`blocked_by_tech`, `is_anchor_boosted`, `evaluate_at`, `evaluated_at`,
`evaluation_result`, `evaluation_note`, `content_draft`,
`snapshot_before` (JSONB), `generated_by`, `reject_reason`

---

## Типы предложений (ease-коэффициенты)

| Тип | ease | Когда создаётся |
|---|---|---|
| `meta` | 1.0 | Позиция > 3, есть Webmaster данные или Wordstat |
| `tech` | 0.9 | Prerender-кэш отсутствует или < порога (brand 50KB, car 30KB) |
| `cluster` | 0.6 | Группа НЧ-запросов из Webmaster (позиция 4–20, показы ≥ 20) |
| `content` | 0.6 | Модельные запросы (jolion, dargo, j7...) с суммарным спросом ≥ 20 |
| `text_block` | 0.5 | Бренд уже имеет ≥ 2 FAQ → текстовый блок вместо FAQ |
| `new_page` | 0.3 | Страница отсутствует в Webmaster данных (не индексируется) |

---

## Формула приоритета

```
priority_score = demand × position_factor × ease × anchor_boost × feedback_discount

position_factor = min((avgPosition - 1) / max(maxPosition, 50), 1)
anchor_boost    = 1.5 если страница в seo_anchor_queries с unmet target
feedback_discount = 0.5 если предыдущая оценка = 'fell' или 'falsified'
```

Ключ для feedback: `${pageUrl}:${type}` — плохая оценка `meta` не штрафует `cluster` той же страницы.

---

## Шаги GAP-анализа (порядок выполнения)

**0** — Загрузка feedback-скидок Karpathy Loop (fell/falsified → 0.5×)

**0.6** — Загрузка active anchor queries с unmet позицией → `anchorPageUrls` Set для ×1.5 буста

**0.5** — Сброс rejected suggestions старше 30 дней → pending

**1** — Загрузка последнего Wordstat-снапшота (≤ 2000 строк, shows > 0)

**2** — Загрузка последнего Webmaster-снапшота → `wbMap` (query → shows/clicks/position)

**3** — Загрузка всех брендов из DB → `brandSlugs` map

**5** — META из Wordstat seed-запросов (только бренды из `BRAND_KEYWORDS`)
- matchBrand() → `/brands/:slug`
- Если нет совпадения или позиция ≤ 3 → пропуск
- Вызывает `buildMetaProposal()` → title/desc из данных DB

**5.1** — META для `/cars` и `/new-cars`
- Ищет Webmaster-запросы по ключевым терминам
- Fallback demand = 50 если нет данных

**5.2** — SITE_WIDE COVERAGE (добавлено последним)
- Загружает **ВСЕ** активные бренды из `brands` WHERE is_active=true
- Для брендов не в `BRAND_KEYWORDS` и не охваченных шагом 5 — создаёт предложения
- Всегда проверяет статические страницы: `/`, `/contacts`, `/about`, `/news`, `/promotions`
- Нет Webmaster данных → `new_page`; есть, но позиция > 3 → `meta`

**5.5** — CONTENT для модельных запросов (jolion, dargo, j7, c5, ...)
- Canonicalizes через `MODEL_CANONICAL_MAP` (латиница ↔ кириллица)
- Суммарный спрос ≥ 20 → предложение добавить модельную секцию

**6** — CLUSTER из Webmaster (позиция 4–20, показы ≥ 20)
- Бренды → `/brands/:slug`
- Generic automotive → `/cars`
- Если у бренда ≥ 2 FAQ → `text_block` вместо `cluster`

**7** — TECH: проверка prerender-кэша для топ-8 brand pages
- Только если кэш-директория существует (VPS, не Replit)
- isTechGap → blocked_by_tech = true для META той же страницы

**8** — Разблокировка META, у которых TECH gap исчез

---

## Karpathy Loop (оценщик)

Файл: `seo-evaluator.ts`

**Когда**: 28 дней после `applied_at`, запускается планировщиком.

**Логика**:
1. Читает `snapshot_before` (позиция до применения)
2. Вычисляет средневзвешенную позицию за последние 28 дней из `seo_query_snapshots`
3. `positionDelta = beforePos - currentPos` (положительное = позиция улучшилась)

**Вердикты**:
- `improved`: delta ≥ 1.5 ИЛИ клики +20%
- `fell`: delta ≤ -2 (позиция ухудшилась)
- `falsified`: delta от -2 до -1 (незначительное ухудшение — только при реальном ухудшении, не при нулевом изменении)
- `stable`: всё остальное

**`capturePositionSnapshot(pageUrl)`**:
- Только для `/brands/:slug` страниц (brand keyword matching)
- Сохраняет в `snapshot_before` JSONB: `{position, clicks, date, queryCount}`

---

## Anchor Queries

Таблица `seo_anchor_queries`:
- `query_text` UNIQUE, `page_url`, `target_position` DEFAULT 10
- `is_active`, `current_position`, `last_checked_at`

GAP проверяет: если активен И последний snapshot показывает позицию > target (или нет данных) → все предложения для этой страницы × 1.5 и `is_anchor_boosted = true`.

UI: badge "🎯 Анкерный" в карточке SuggestionCard.

---

## buildMetaProposal() — какие страницы поддерживаются

- `/cars` — запрашивает COUNT/MIN price из таблицы cars WHERE type='used'
- `/new-cars` — COUNT/MIN price/brands из cars WHERE type='new'
- `/brands/:slug` — JOIN brands + brand_page_content + cars (min_price, max_discount, models)
- Все остальные → возвращает null (статические страницы обрабатываются inline в step 5.2)

---

## BRAND_KEYWORDS (хардкод в gap.ts)

Только эти бренды проходят через шаг 5 (META из Wordstat):
`haval-city`, `omoda`, `jaecoo`, `jetour`, `tenet`, `soueast`,
`mercedes-benz`, `volkswagen`, `skoda`, `exeed`

Остальные бренды из DB охватываются шагом **5.2 SITE_WIDE**.

---

## Правила при доработке GAP

1. Все INSERT используют `ON CONFLICT (type, page_url) DO UPDATE ... WHERE status = 'pending'` — applied/rejected предложения не перезаписываются
2. Перед regenerate cluster/content/text_block: `DELETE ... WHERE type=X AND status='pending'` (удаление устаревших)
3. TECH suggestions полностью не генерируются если кэш-директория не смонтирована (Replit dev)
4. `blocked_by_tech = true` на META пока есть pending TECH для той же страницы
5. `seen` Set использует формат `type:pageUrl` для дедупликации внутри одного запуска
6. После отрицательной оценки повторную гипотезу создаём только для последнего проваленного результата, без активной pending-карточки и при наличии содержательно нового варианта. Если вариант не прошёл проверку — пропускаем создание; для остальных типов сначала нужна отдельная стратегия регенерации.

**Why:** Система спроектирована так, чтобы каждый запуск GAP был идемпотентным и не ломал уже одобренные улучшения. Новая запись с тем же текстом не является новым SEO-экспериментом и может ввести менеджера в заблуждение.

**How to apply:** Для повторной meta-гипотезы подавлять обычные детерминированные шаблоны, формировать новый AI-вариант по текущим мета-тегам и причине провала, сверять с live-значениями и историей, проверять отличие и длину. Если проверка не прошла — не вставлять повтор. Для новых типов сначала реализовать их отдельный валидированный генератор.

---

## Deployment

После изменений в `seo-gap.ts` или `seo-evaluator.ts`:
1. `cd artifacts/api-server && pnpm run build`
2. SCP `dist/index.mjs` → VPS `/opt/debryansk/api/`
3. `pm2 restart debryansk-avto`
4. health check: `curl -sf http://localhost:8080/api/health`
