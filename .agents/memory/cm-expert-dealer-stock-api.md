---
name: CM Expert dealer stock API
description: Verified global-list behavior and the authorized single-car GET/PATCH methods for CM Expert Business API.
---

## Rule

Treat `/dealers/dms/cars` as a global list and filter rows by `dealerId` and `stockState` locally. Dealer-related query parameters did not filter the list, and the dealer-scoped list `/dealers/{dealerId}/dms/cars` returned 403. Do not confuse that list route with the single-car GET documented below. The `page` parameter works; `perPage` is capped at 50. The response is a plain array without total-page metadata, so continue until a page is shorter than 50 or empty, and deduplicate by a stable record ID.

`stockState: "in"` is the stock-present value used by the existing sync code; `saleStatus` is a separate field and should not replace it as the inventory criterion.

The full API record contains customer and internal commercial data. Never forward the raw response to a public endpoint; explicitly map only fields approved for the website.

CM Expert web card links use `https://lk.cm.expert/stock/{numericStockId}/stock`. For Tenet Plus rows mirrored from the CM feed, the numeric suffix after `cme-` in `external_id` maps to the card ID. A generated link for `tenet-plus-cme-83183067` opened the correct card, confirmed by the user. Do not assume this mapping applies to unrelated ID formats.

An observed in-stock Jeland DMS row had many per-feature `has*` fields, while `equipmentName` was null. Treat options as per-car source facts, not as a list inferred from a trim or modification label.

**Why:** A generated quote that guesses equipment from a trim may claim features the individual car does not have.

**How to apply:** If importing options, audit which feature fields are reliably populated across the dealer's stock, map verified affirmative fields to localized labels, and leave unknowns absent instead of fabricating equipment.

In the observed Tenet Plus stock snapshot, all 26 in-stock rows lacked affirmative `has*` equipment flags and recognized equipment enums. Their `description` text was nearly identical across cars, not a per-car equipment source.

**Why:** A working CM stock feed does not imply that it supplies verified equipment for every dealer; a shared options importer can legitimately produce empty lists for an entire dealer.

**How to apply:** Keep Tenet Plus options empty with a manager warning until CM provides vehicle-specific feature fields or another verified per-VIN source is available. Do not populate from `equipmentName`, a generic description, or a guessed trim catalog.

The user chose to wait for per-car Tenet Plus equipment to appear in CM rather than source it elsewhere for now.

**Why:** No verified per-VIN alternative is available, and inferred equipment would be misleading.

**How to apply:** Keep the empty-list warning until CM starts supplying confirmed per-car values; if the new data uses different fields, verify and map them before publication rather than assuming the existing field mapping covers them.

**Why:** A dealer-specific test required scanning the global feed; filters were ignored, the scoped route was denied, and larger requested pages still returned at most 50 rows. The response includes fields that must not be exposed publicly.

**Why:** The CM UI route was not documented by the public Swagger page; the user verified a generated Tenet Plus card link. The number in the link must be sourced from the CM stock identifier, not guessed.

**How to apply:** When building a dealer-scoped importer, scan to the terminal page with bounded concurrency, filter by dealer and exact stock state, surface truncation if a safe page limit is reached, map a strict public-field allowlist, and generate CM links only from verified CM stock IDs.

## Refreshing one car from the quote form

Use `GET /dealers/{dealerId}/dms/cars/{dmsCarId}` for a manager-triggered single-car refresh. This route was validated against production and returned the exact DmsCar. `dmsCarId` is the DMS identifier, not CM Expert's numeric `id` (`cmStockId` in our database); URL-encode both path segments. Access requires permission for the dealer and an enabled dealer stock. `PATCH` on this same path writes changes to CM and must not be used to pull data into our database.

**Why:** The global list ignores `id`, `stockId`, `dmsCarId`, `vin`, and `dealerId` query filters, so a full scan is slow. The direct GET avoids that scan while preserving exact identity checks; quote PDFs prefer verified equipment over catalog equipment, and bulk sync can run concurrently with a manager's refresh.

**How to apply:** Require a DMS ID and valid VIN before offering the action; call the direct GET, then validate dealer ID, DMS ID, VIN, and any known numeric CM stock ID. Perform a guarded one-row update, compute warnings from the saved row, and mark the row manually verified so quote creation and later PDF regeneration do not overwrite it with a separate cached supplier feed. Never forward raw CM records, and do not fall back to a global scan when the DMS ID is missing.