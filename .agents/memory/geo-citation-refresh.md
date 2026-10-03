---
name: GEO citation refresh
description: The intended behavior and cost context for refreshing the admin GEO report.
---

## Rule
The admin GEO action starts a fresh weekly measurement; it must not only reread the saved report.

**Why:** The user chose a new measurement after being informed that a run can make up to 20 requests per configured AI provider and consume API credits.

**How to apply:** Keep future changes to the GEO refresh control and endpoint aligned with this distinction between starting a measurement and loading its saved results.