---
name: Yandex Metrika CSP endpoint
description: Required Content Security Policy source for Yandex Metrika's secondary script.
---

Yandex Metrika bootstraps from `mc.yandex.ru` but can request another script from `mc.yandex.com`. Both hosts are needed in `script-src`; otherwise the analytics bootstrap may appear loaded while browser logs show CSP-blocked telemetry code.

**Why:** Local prerendering exposed a runtime CSP violation for the `.com` host after the main Metrika script loaded.

**How to apply:** When tightening the site's CSP, allow `https://mc.yandex.com` alongside the existing `mc.yandex.ru` source. Keep the broader `connect-src` policy consistent with the application's analytics requirements.
