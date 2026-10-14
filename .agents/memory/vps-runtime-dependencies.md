---
name: VPS runtime dependency updates
description: Safe procedure for updating externalized Node runtime dependencies on the production VPS.
---

The production VPS runs the API from a bundle plus an existing `node_modules` tree, without the workspace package manifest and lockfile. Dependencies externalized by esbuild must be updated in that runtime tree as part of deployment.

**Why:** Running `npm install --no-save` in the API directory without a manifest can prune unrelated packages that the bundle still loads at runtime, causing the next PM2 restart to fail even when the requested package versions installed successfully.

**How to apply:** Preserve or restore the complete existing runtime tree first, then overlay the required package updates and verify every externalized module before restarting PM2. Prefer a hardlink/copy from a known-good VPS backup when available; use the standard deploy script for bundle transfer and health checks, and use a single SSH ControlMaster session when the VPS intermittently refuses new connections.

For ad hoc Puppeteer profiling on the VPS, run Node from `/opt/debryansk/api` so ESM resolves the runtime dependency tree; importing from the repository root may fail even though the production prerender script works.

**Why:** The VPS runtime dependency location is not reliably discoverable through package resolution from every working directory.

**How to apply:** Before running a one-off Puppeteer script, `cd /opt/debryansk/api`; do not install or duplicate Puppeteer into the repo root.