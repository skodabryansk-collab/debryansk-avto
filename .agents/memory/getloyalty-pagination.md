---
name: GetLoyalty pagination wrap-around
description: GetLoyalty /api/v2/reviews paginates but wraps around — page 2+ repeats page 1 indefinitely. Must detect and deduplicate.
---

## Rule
When fetching from GetLoyalty, always:
1. Track seen IDs with a `Set<string>` across pages
2. Break the page loop when `page > 1` and the first item of the new page was already seen (wrap-around detection)
3. Deduplicate the collected `rawList` by `r.id` before inserting into DB

## Why
The API wraps around after all reviews are returned. Without deduplication, `upserted=300` but only 6 unique rows actually exist in the DB — the same 6 rows get `ON CONFLICT DO UPDATE` ~50 times each.

## How to apply
In `reviews-sync.ts` `syncReviews()` function:
- `seenIds = new Set<string>()` before the page loop
- Inside loop: check `seenIds.has(firstId)` before pushing items
- After loop: `dedupeMap = new Map<string, R>()` keyed by `r.id`, iterate rawList and skip duplicates
- Iterate `deduped` (not `rawList`) for DB inserts

## Client data reality
This client (Дебрянск Авто) has ~6–10 reviews passing the filter (4–5 stars, last 90 days, non-excluded platform). `overallCount` from sourcesMap is ~8991 (all-time across all platforms).
