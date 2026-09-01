---
name: VIN engine enrichment priority
description: Source-priority and retry rules for engine characteristics resolved through CM Expert.
---

Store XML-derived characteristics as `xml_pending` until the VIN lookup has actually run. Promote to `cm_vin` only after an exact `modification.id === techParamId` match. A regular feed sync must preserve existing `cm_vin` values when VIN and modification are unchanged.

**Why:** Treating a synchronous XML fallback as a completed lookup can suppress the first CM backfill for 24 hours, while feed-first upserts can silently replace authoritative CM values with inferred data.

**How to apply:** New or changed cars may receive immediate XML fields, but remain pending for the bounded background resolver. After a failed exact lookup, record `xml_fallback` with the attempt timestamp and retry only after the cooldown.

CM Expert's Swagger page at `lk.cm.expert/api/v1/doc` is a web-session documentation UI, not the server API endpoint. Server integrations use the OAuth token against `appraisal.api.cm.expert/v1`; VIN conversion values must be normalized to numeric catalog brand/model IDs before requesting modifications.

**Why:** Calling `autocatalog/modifications` with raw VIN-converter IDs can return 400 even though OAuth and VIN conversion are healthy.

**How to apply:** Validate the connection with `autocatalog/brands`, `converting/vin/autoru`, numeric `autocatalog/models`, then exact `autocatalog/modifications` matching.

For stock-level fuel, use CM Expert Business API `GET https://lk.cm.expert/api/v1/dealers/dms/cars`, not Auto.ru user offers. The confirmed ASP dealer is `2430` (Крона-Авто); the endpoint returns 20 rows per `page`, ignores dealer/state query filters, and must be filtered client-side by `dealerId=2430` and `stockState=in`. It has no total-page marker, so bounded pagination must report truncation instead of claiming a complete inventory.

**Why:** The first page mixes multiple dealer IDs and includes historical `out` records; treating its 20 rows as the stock silently misses most ASP cars.

**How to apply:** Keep the source as `cm_cabinet`, match only exact VINs, and preserve the no-inference rule for cars not returned by the confirmed dealer stock.

After a VIN match, persist CM's stable `dmsCarId` and allow it as the only fallback on later runs when VIN data changes; never fall back to brand/model similarity.

**Why:** A DMS vehicle can keep its identity while a feed VIN is corrected, but model-level guesses can put fuel data on the wrong car.

**How to apply:** Use VIN first, then a previously persisted DMS ID, and write fuel/engine details only to `type='used'` cards from the confirmed ASP stock.