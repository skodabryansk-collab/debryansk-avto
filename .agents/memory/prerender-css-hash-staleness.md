---
name: Prerender CSS hash staleness
description: GCS prerender cache for "/" can survive Vite rebuilds with the old CSS hash, breaking styles for all users.
---

## The Rule
`"/"` must be in `SSG_ROUTES` in `prerender.ts` so the prerender middleware always falls through to `seoMeta` for the home page. When `seoMeta` preserves the richer cached homepage snapshot, it must rewrite its hashed JS and CSS tags from the live deployed build before returning it.

**Why:** Vite adds content hashes to JS and CSS. An old GCS/Puppeteer snapshot can survive a deploy while referencing the previous bundle, so visitors silently execute stale functionality even though the fresh files are on disk. Passing `"/"` through `seoMeta` alone is insufficient if its homepage snapshot remains preferred.

**How to apply:**
- Keep `SSG_ROUTES` in `artifacts/api-server/src/middleware/prerender.ts` containing `"/"`.
- Keep the homepage snapshot for its richer content, but normalize its asset tags against the live `dist/public/index.html` before serving it.
- `seoMeta` is responsible for injecting correct meta (title, description, canonical, JSON-LD) onto the SSG home page.
- After any Vite rebuild, both JavaScript behavior and CSS are current without needing to invalidate the GCS prerender cache.
- If Puppeteer prerender of `"/"` is desired for richer bot HTML, run it AFTER deploy and update GCS; the in-memory cache will be refreshed on next server restart.
- On the VPS, `/` is protected from the internal prerender-update endpoint. A manual root prerender updates the disk snapshot but not the running process cache; restart PM2 afterward to load it.

**Why:** The homepage can keep serving its old hero markup and preload links even after the new frontend index and assets are on disk.

**How to apply:** After deploying frontend assets, run `prerender.mjs --route /`, restart PM2, then verify the public root HTML contains the new preload links before auditing.
