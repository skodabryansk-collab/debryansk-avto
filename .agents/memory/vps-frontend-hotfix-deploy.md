---
name: VPS frontend hotfix deploy
description: Safe frontend-only deploys to the VPS when production contains HTML generated from VPS-only data.
---

# VPS frontend hotfix deploy

**Rule:** For a frontend-only hotfix, keep production page bodies intact: back up the current HTML, merge the new root `index.html` and built assets into the frontend directory without deleting old assets, then update only the app-entry JS/CSS references in every existing HTML file to the new hashes. Restart PM2 after the file update so the API reloads its in-memory asset tags.

**Why:** Some production pages use VPS-only database content and cannot be safely regenerated from the Replit build. Also, the running API can keep serving stale cached asset references after the files on disk are replaced.

**How to apply:** Verify the HTML page count is unchanged, that all pages reference the new entry JS/CSS, and that the public root, key routes, and new assets return 200 after restarting PM2. Do not replace route-specific page bodies as part of a frontend-only hotfix.
