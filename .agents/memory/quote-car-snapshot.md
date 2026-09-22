---
name: Quote car snapshot freshness
description: Commercial quotes can outlive the car sync that supplies their photo and color.
---

The quote PDF path must refresh new-car color, image, and catalog-derived equipment from the live catalog when creating or rebuilding a quote, then persist the refreshed values in `carSnapshot`. Supplier feeds may leave `extras` empty for an entire brand, so a verified brand/model/trim catalog fallback is needed.

**Why:** An older quote was created while `cars.image_url` was NULL even though the supplier feed and public site later had a photo; reusing the old snapshot produced a placeholder PDF. Tenet Plus feeds also expose trim names but no options, which otherwise makes the entire equipment section blank.

**How to apply:** Do not treat a stored quote snapshot as authoritative for current catalog fields during PDF regeneration. Keep the database row as the fallback when the live feed is unavailable.