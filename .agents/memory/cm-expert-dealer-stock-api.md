---
name: CM Expert dealer stock API
description: Observed pagination, filtering, stock-state, and data-exposure behavior for the Business API DMS car list.
---

## Rule

Treat `/dealers/dms/cars` as a global list and filter rows by `dealerId` and `stockState` locally. In the observed API, dealer-related query parameters did not filter the list, and `/dealers/{dealerId}/dms/cars` returned 403. The `page` parameter works; `perPage` increased the page size but was capped at 50 even when requesting 100. The response is a plain array without total-page metadata, so continue until a page is shorter than 50 or empty, and deduplicate by a stable record ID.

`stockState: "in"` is the stock-present value used by the existing sync code; `saleStatus` is a separate field and should not replace it as the inventory criterion.

The full API record contains customer and internal commercial data. Never forward the raw response to a public endpoint; explicitly map only fields approved for the website.

CM Expert web card links use `https://lk.cm.expert/stock/{numericStockId}/stock`. For Tenet Plus rows mirrored from the CM feed, the numeric suffix after `cme-` in `external_id` maps to the card ID. A generated link for `tenet-plus-cme-83183067` opened the correct card, confirmed by the user. Do not assume this mapping applies to unrelated ID formats.

**Why:** A dealer-specific test required scanning the global feed; filters were ignored, the scoped route was denied, and larger requested pages still returned at most 50 rows. The response includes fields that must not be exposed publicly.

**Why:** The CM UI route was not documented by the public Swagger page; the user verified a generated Tenet Plus card link. The number in the link must be sourced from the CM stock identifier, not guessed.

**How to apply:** When building a dealer-scoped importer, scan to the terminal page with bounded concurrency, filter by dealer and exact stock state, surface truncation if a safe page limit is reached, map a strict public-field allowlist, and generate CM links only from verified CM stock IDs.