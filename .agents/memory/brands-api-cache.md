---
name: Public brands cache safety
description: Reliability and inventory-visibility rules for the navigation brands endpoint.
---

# Public brands cache safety

`/api/brands` is navigation-critical: return the last persisted snapshot immediately, then refresh counts in the background. If no snapshot exists, respond from database counts without waiting for external inventory feeds. Keep the last good snapshot when a refresh fails.

TENET Plus and Jeland counts are an exception: show them only when a complete current feed confirms the exact IDs used for the count. Otherwise return zero rather than risk exposing hidden or withdrawn stock.

**Why:** A slow inventory provider previously held up the brands endpoint, while incomplete CM Expert snapshots must not make unpublished inventory appear public.

**How to apply:** Preserve the stale-while-revalidate path for `/api/brands`; any changes to TENET Plus or Jeland count logic must retain complete-feed and ID-signature verification.
