---
name: Yandex Maps v3 CSP
description: Host sources required by Yandex Maps v3 and why the apex yastatic.net must be explicit.
---

Yandex Maps v3 loads its main JavaScript and stylesheet, plus control bundles, from `https://yastatic.net`. In CSP, `https://*.yastatic.net` does not authorize the bare `yastatic.net` host; both the apex and wildcard host source are needed in `script-src` and `style-src`.

**Why:** The Maps API endpoint may return 200 and set `window.ymaps3`, while CSP silently blocks the bundle and stylesheet. The map then remains an empty container with no tiles.

**How to apply:** When Yandex Maps v3 is blank, inspect browser CSP errors and tile requests. Allow the bare yastatic.net host as well as its subdomains for scripts and styles, then confirm bundle and tile responses succeed.
