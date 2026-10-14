---
name: H1 injection for bot-visible HTML
description: How seoMeta middleware injects H1 into static SPA shell for crawlers
---

# H1 injection pattern

## The rule
The SPA shell (`dist/public/index.html`) can have no H1, while a prerendered page can already contain its visible H1. `seoMeta` should add a hidden fallback only when there is no H1 in the HTML, and remove any older injected offscreen SEO `<main>` before checking. After hydration, the client removes the fallback if the React page rendered a real H1.

**Why:** Injecting unconditionally duplicated headings on cached prerenders, while omitting a fallback from the empty SPA shell left crawlers without an H1. Keep raw HTML complete without duplicating visible page headings.

## How to apply
When adding static routes to `STATIC_META` in `seoMeta.ts`, provide an `h1` value; it is used only when the page HTML has no heading. Preserve the client cleanup so hydrated pages show only the real page H1.
