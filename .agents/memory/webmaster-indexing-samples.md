---
name: Yandex Webmaster indexing samples
description: Supported Webmaster v4 endpoint and pagination behavior for recent HTTP status samples.
---

Yandex Webmaster API v4 does not provide `/crawling/samples`. Use `/indexing/samples` with `limit` and `offset`; the response contains `status`, `http_code`, `url`, and `access_date`.

**Why:** `/crawling/samples` returns `RESOURCE_NOT_FOUND`, while `/indexing/samples` works. The API can return old records first, so a request at `offset=0` may contain only historical pages and miss current 4xx/5xx responses.

**How to apply:** For recent technical GAP checks, read from the last page and walk backwards until `access_date` is outside the analysis window. Filter `HTTP_4XX`/`HTTP_5XX` and numeric 4xx/5xx codes; do not treat `OTHER` as an HTTP error.