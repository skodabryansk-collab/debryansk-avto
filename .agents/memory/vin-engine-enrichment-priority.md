---
name: VIN engine enrichment priority
description: Source-priority and retry rules for engine characteristics resolved through CM Expert.
---

Store XML-derived characteristics as `xml_pending` until the VIN lookup has actually run. Promote to `cm_vin` only after an exact `modification.id === techParamId` match. A regular feed sync must preserve existing `cm_vin` values when VIN and modification are unchanged.

**Why:** Treating a synchronous XML fallback as a completed lookup can suppress the first CM backfill for 24 hours, while feed-first upserts can silently replace authoritative CM values with inferred data.

**How to apply:** New or changed cars may receive immediate XML fields, but remain pending for the bounded background resolver. After a failed exact lookup, record `xml_fallback` with the attempt timestamp and retry only after the cooldown.