---
name: Auto.ru stock image resizing
description: Resizing limitations of the avatars.avto.ru stock-photo CDN and safe alternatives.
---

`avatars.avto.ru/get-cme-media/<id>/<hash>/optimize` returns the same full-resolution JPEG when `?width=640&height=384` is appended; the tested response stayed 1,550,018 bytes. Do not assume this URL supports resize query parameters.

**Why:** Large stock photos dominate homepage transfer, and unsupported URL parameters silently leave payloads unchanged.

**How to apply:** Resize server-side with Sharp, allow only the exact `avatars.avto.ru` host and expected `/get-cme-media/.../optimize` path, cap source bytes and processing concurrency, and cache generated WebP variants.
