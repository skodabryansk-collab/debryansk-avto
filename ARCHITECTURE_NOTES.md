# Architecture Notes — Дебрянск Авто

## Production routing: статика vs Express (важно!)

**Проблема, найденная и исправленная 20 июня 2026:**

В production Replit изначально раздавал статику `debryansk-avto` напрямую через свой CDN/static-слой (`artifact.toml: paths = ["/"], serve = "static"`), а api-server обрабатывал только `paths = ["/api"]`. Это означало, что весь frontend-трафик (запросы к `/`, `/brands/jetour`, `/cars/CME_123` и т.д.) никогда не достигал Express — ни `prerenderMiddleware`, ни `seoMetaMiddleware` не срабатывали. Googlebot всегда получал пустой SPA shell (3 470 байт, без meta-тегов).

**Симптом:** Googlebot видит `content-length: 3470`, нет заголовков `X-Prerendered` или `X-SeoMeta`. В `debug/prerender-cache` кэш заполнен (442 страницы, `hasRoot: true`), но к нему никто не обращается.

**Корень проблемы:**

```
До исправления:
  GET /                →  Replit CDN (debryansk-avto, serve=static)  →  index.html (3 470 б)
  GET /brands/jetour   →  Replit CDN (debryansk-avto, serve=static)  →  index.html
  GET /api/cars/new    →  Express api-server (port 8080)             →  JSON ✓

  Express middleware НИКОГДА не видит frontend-запросы в production.

После исправления:
  GET /                →  Replit CDN  →  Express api-server (paths=["/"])
                                               ↓
                                       prerenderMiddleware (X-Prerendered: 1)
                                       или seoMetaMiddleware (X-SeoMeta: 1)
  GET /api/cars/new    →  Express api-server  →  JSON ✓
```

**Исправление:**

`artifacts/api-server/.replit-artifact/artifact.toml`:
```toml
# было:
paths = ["/api"]

# стало:
paths = ["/"]
```

`artifacts/debryansk-avto/.replit-artifact/artifact.toml`:
```toml
# было:
[services.production]
build = [...]
publicDir = "artifacts/debryansk-avto/dist/public"
serve = "static"
[[services.production.rewrites]]
from = "/*"
to = "/index.html"

# стало:
[services.production]
build = [...]
# serve = "static" убрано — Express сам раздаёт статику через express.static()
```

**Правило на будущее:** Если нужна любая серверная логика на frontend-маршрутах в production (middleware, SSR, prerender, A/B тесты, редиректы) — api-server должен держать `paths = ["/"]`. `serve = "static"` у web-артефакта полностью обходит Express.

---

## Prerender / SEO pipeline

**Схема работы (после исправления routing-а):**

```
Production запрос от Googlebot:
  GET /brands/jetour
    → Express (api-server, port 8080)
    → prerenderMiddleware
        ├─ cache hit  →  отдаёт полный HTML (176 КБ, X-Prerendered: 1)
        └─ cache miss →  seoMetaMiddleware
                            ├─ meta из БД → index.html + инжектированный <title>, og:* (X-SeoMeta: 1)
                            └─ не бот / файл → express.static / SPA fallback
```

**Компоненты:**

| Файл | Назначение |
|------|-----------|
| `artifacts/api-server/src/middleware/prerender.ts` | In-memory кэш prerendered HTML (загружается из GCS при старте) |
| `artifacts/api-server/src/middleware/seoMeta.ts` | Инжект meta-тегов в index.html для ботов при cache miss |
| `artifacts/api-server/scripts/prerender.mjs` | Puppeteer-краулер: обходит все маршруты, сохраняет в GCS + live-обновление кэша |
| `artifacts/api-server/src/index.ts` | Запускает `prerender.mjs` при старте и раз в 6 часов |
| `artifacts/debryansk-avto/scripts/ssg.mjs` | SSG: генерирует `dist/public/<route>/index.html` при `pnpm build` |

**Два уровня SEO-защиты:**
1. **Puppeteer prerender** — полный отрендеренный HTML с данными (приоритет для ботов)
2. **seoMetaMiddleware** — meta-инжект в SPA shell (fallback если prerender не успел/упал)

**Debug endpoint:** `GET /api/debug/prerender-cache?secret=<PRERENDER_INTERNAL_SECRET>`

---

## Локальная разработка vs Production

| | Dev | Production |
|--|-----|-----------|
| Frontend | Vite dev server (port 19052, HMR) | Express (serve из `debryansk-avto/dist/public`) |
| API | Express (port 8080) | Express (port 8080) |
| Routing `/` | Vite (port 19052) через Replit proxy | Express api-server (paths=["/"]) |
| Routing `/api` | Vite proxy → Express | Express api-server |
| Prerender | Отключён (PRERENDER_ENABLED≠true) | Включён (GCS, Puppeteer) |

**Важно:** В dev preview оба артефакта (`debryansk-avto` и `api-server`) заявляют `paths = ["/"]`. Replit отдаёт предпочтение Vite (порт 19052). Это ожидаемо.
