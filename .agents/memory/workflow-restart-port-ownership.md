---
name: Workflow restart port ownership
description: Diagnosing an API workflow restart that continues serving an older build.
---

If an API restart appears to serve old code, verify which process owns the configured port before trusting local HTTP checks.

**Why:** An earlier API process can survive a workflow restart and retain port 8080, so requests keep reaching its stale bundle while the new workflow process starts separately.

**How to apply:** Inspect the port listener through `/proc`, stop only the stale workflow parent, then restart the configured workflow and verify there is one current API process before testing.