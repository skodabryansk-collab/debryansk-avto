---
name: News SEO & gallery
description: SEO fixes for news detail pages and mobile gallery implementation lessons.
---

# News page SEO — что было сломано и как исправлено

## Stale JS hash на новостных страницах VPS
Статьи созданные через Админку (VPS-only БД) не попадают в Replit-сборку SSG. Puppet-rendered HTML для этих статей оседает на диске VPS и переживает последующие деплои (tar xzf добавляет файлы но не удаляет старые).

**Fix:** `scripts/deploy-vps.sh` теперь выполняет `rm -rf /opt/debryansk/frontend/news/` перед загрузкой новых файлов. Браузеры при следующем запросе получают свежий `index.html` с актуальным JS-хешем.

## seoMeta — что инжектируется для /news/:slug
- `title`: из DB (`news.title`)
- `description`: используем содержательный `news.excerpt`; пустой или шаблонный текст вроде «Скоро в продаже» заменяем фрагментом `content`
- `og:image`: `images[0]` → `image` → DEFAULT_OG_IMAGE (было всегда DEFAULT — исправлено)
- `og:type`: `article` (было `website` — исправлено через `ogType` в MetaResult)
- `NewsArticle` JSON-LD: headline, description, image, datePublished из `published_at`, publisher
- bodyHtml: stripped `news.content` (до 8000 символов) как hidden `<article>` для ботов

**Why:** news pages используют SSG-маршрут (isSsgRoute=true), Puppeteer не запускается. Текст статьи невидим ботам без bodyHtml инъекции.

## MetaResult тип
Добавлен `ogType?: string` в тип MetaResult и параметр `injectMeta`. В meta block `og:type` теперь `ogType || "website"`.

## Mobile gallery
HeroGallery (grid: 58% main + thumbnails right) показывается на всех экранах (mobile+desktop). MobileCarousel удалён. `object-cover object-center` обеспечивает адаптацию фото под тайл. Высоты: `h-52 sm:h-80` для main + right column.

Lightbox: touch swipe (threshold 50px) добавлен через `onTouchStart/Move/End` на overlay div.

## Placeholder excerpts
Новостной excerpt может быть заполнен шаблонным текстом («Скоро в продаже»), поэтому непустое значение само по себе не означает, что оно годится для сниппета. В этом случае description нужно строить по тексту статьи.

**Why:** одинаковый placeholder дал одинаковые поисковые описания для разных новостей.

**How to apply:** при изменении генерации метаданных учитывай как пустые excerpt, так и короткие шаблонные значения; клиентские SEO-теги и серверные метаданные должны использовать один и тот же fallback.
