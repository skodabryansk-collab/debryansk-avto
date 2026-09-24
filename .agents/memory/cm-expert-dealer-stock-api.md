---
name: CM Expert dealer stock API
description: Observed pagination, filtering, stock-state, and data-exposure behavior for the Business API DMS car list.
---

## Rule

Treat `/dealers/dms/cars` as a global list and filter rows by `dealerId` and `stockState` locally. In the observed API, dealer-related query parameters did not filter the list, and `/dealers/{dealerId}/dms/cars` returned 403. The `page` parameter works; `perPage` increased the page size but was capped at 50 even when requesting 100. The response is a plain array without total-page metadata, so continue until a page is shorter than 50 or empty, and deduplicate by a stable record ID.

`stockState: "in"` is the stock-present value used by the existing sync code; `saleStatus` is a separate field and should not replace it as the inventory criterion.

The full API record contains customer and internal commercial data. Never forward the raw response to a public endpoint; explicitly map only fields approved for the website.

**Why:** A dealer-specific test required scanning the global feed; filters were ignored, the scoped route was denied, and larger requested pages still returned at most 50 rows. The response includes fields that must not be exposed publicly.

**How to apply:** When building a dealer-scoped importer, scan to the terminal page with bounded concurrency, filter by dealer and exact stock state, surface truncation if a safe page limit is reached, and map a strict public-field allowlist.