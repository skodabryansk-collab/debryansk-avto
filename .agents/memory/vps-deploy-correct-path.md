---
name: VPS deploy correct path
description: PM2 runs from /opt/debryansk/api/, not /opt/debryansk/dist/. @workspace/integrations-openai-ai-server must be bundled.
---

# VPS Deploy — Correct Target Path

## Rule
Deploy API bundle to `/opt/debryansk/api/`, not `/opt/debryansk/dist/`.
PM2 start script is `/opt/debryansk/start.sh` → runs `node /opt/debryansk/api/index.mjs`.

**Why:** Previous deploys were going to `/opt/debryansk/dist/` which is unused. The server kept running the old binary silently.

Rebuild API and admin immediately before deploying. The deploy script checks that `dist` exists but does not confirm it matches current source. Stage bundles first, compare hashes before and after installation, back up the current binary, and restart PM2 only after all expected files are present. Preserve `/opt/debryansk/api/node_modules`: broad archive extraction or package updates can remove its external runtime dependencies.

**Why:** A stale bundle can silently deploy old behavior, while replacing the runtime directory can crash PM2 with missing packages even when the bundle itself is valid.

**How to apply:** Prefer the verified deployment script; if SSH drops after a partial transfer, stage the remaining files and copy only the expected paths without deleting the API directory.

## How to apply
```bash
tar czf /tmp/api-full.tar.gz -C artifacts/api-server/dist index.mjs pino-file.mjs pino-pretty.mjs pino-worker.mjs thread-stream-worker.mjs kp-template.html logo-da.svg
scp /tmp/api-full.tar.gz root@5.42.110.134:/tmp/
ssh root@5.42.110.134 'cp /opt/debryansk/api/index.mjs /opt/debryansk/api/index.mjs.bak.$(date +%s) && tar xzf /tmp/api-full.tar.gz -C /opt/debryansk/api/ && pm2 restart debryansk-avto --update-env'
```

## @workspace/integrations-openai-ai-server
Must be **BUNDLED** (NOT in esbuild externals). This package is not installed on VPS, so if marked external the server crashes on startup with ERR_MODULE_NOT_FOUND. Only `openai` itself is truly external (dynamic require crash).

The old memory entry "[OpenAI esbuild external](openai-esbuild-external.md)" is WRONG about this package — only `openai` needs to be external.

## Prerender cache in-memory
Prerender cache is loaded into RAM on startup from `/opt/debryansk/prerender-cache/`. Deleting disk files does NOT clear in-memory cache. Must restart server after deleting cache files.
