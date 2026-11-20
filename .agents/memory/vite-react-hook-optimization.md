---
name: Vite React hook dependency optimization
description: Prevent mid-session React hook runtime errors when Vite discovers react-hook-form late.
---

When Vite logs a newly optimized `react-hook-form` dependency immediately before `dispatcher.useEffect` becomes null, list it in `optimizeDeps.include` and restart the admin-panel workflow so it is optimized before the page loads.

**Why:** Vite's dependency optimizer triggered a browser reload immediately before the reported dispatcher error; a clean restart with the dependency pre-optimized loaded the admin login without the runtime overlay.

**How to apply:** Check for a `new dependencies optimized` log before diagnosing hook usage or React duplication. Pre-optimize the dependency, restart the managed Vite workflow, then verify the affected route; authenticated pages still need a signed-in check.
