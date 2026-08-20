---
name: Route health and safe prerender publication
description: Rules for preventing stale or error-page snapshots from being indexed.
---

The searchable URL inventory must include both the current database registry and every existing prerender cache route. A cache entry not backed by the active registry is an orphan and must be removed or return a crawler-safe terminal status; checking only known DB pages misses the most dangerous failures.

**Why:** A stale brand snapshot can contain a valid-looking HTML response with an application error message and still be served to bots as HTTP 200 after its slug is deleted or renamed.

**How to apply:** Validate a snapshot’s page-level SEO markers and error markers before publishing it, publish the HTML atomically with a sidecar manifest, and surface orphan/broken states in the same technical health stream used by audit and GAP. Treat crawler HTTP status as a first-class health signal, not a cache-size proxy.