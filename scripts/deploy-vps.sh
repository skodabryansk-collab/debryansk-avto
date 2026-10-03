#!/usr/bin/env bash
# Deploy Дебрянск Авто to Timeweb VPS
# Usage: bash scripts/deploy-vps.sh [--skip-frontend] [--skip-api] [--skip-admin]
# Run from workspace root: /home/runner/workspace
#
# READ .agents/skills/vps-deploy/SKILL.md before modifying this script!

set -euo pipefail

VPS_HOST="root@5.42.110.134"

log() { echo "[deploy $(date +%H:%M:%S)] $*"; }
fail() { echo "[deploy] ERROR: $*" >&2; exit 1; }

[ -z "${VPS_SSH_PASSWORD:-}" ] && fail "VPS_SSH_PASSWORD env var not set"

# ── SSH helper (ALWAYS use sshpass wrapper) ──────────────────────────────────
ssh_vps() {
  sshpass -p "$VPS_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 "$VPS_HOST" "$@"
}

SKIP_FRONTEND=0
SKIP_API=0
SKIP_ADMIN=0
for arg in "$@"; do
  [[ "$arg" == "--skip-frontend" ]] && SKIP_FRONTEND=1
  [[ "$arg" == "--skip-api" ]] && SKIP_API=1
  [[ "$arg" == "--skip-admin" ]] && SKIP_ADMIN=1
done

log "=== Дебрянск Авто → VPS Deploy ==="
log "Flags: frontend=$SKIP_FRONTEND api=$SKIP_API admin=$SKIP_ADMIN"

# ════════════════════════════════════════════════════════════════════════════
# 1. PRE-FLIGHT CHECKS (local)
# ════════════════════════════════════════════════════════════════════════════
log "Pre-flight checks..."

if [[ "$SKIP_API" -eq 0 ]]; then
  [ -f "artifacts/api-server/dist/index.mjs" ] || fail "API dist/index.mjs not found. Run: pnpm --filter @workspace/api-server run build"
  [ -f "artifacts/api-server/dist/geo-citation-check.mjs" ] || fail "API GEO citation script not found. Run: pnpm --filter @workspace/api-server run build"
fi
if [[ "$SKIP_FRONTEND" -eq 0 ]]; then
  [ -f "artifacts/debryansk-avto/dist/public/index.html" ] || fail "Frontend dist/public/index.html not found. Run: pnpm --filter @workspace/debryansk-avto run build"
fi
if [[ "$SKIP_ADMIN" -eq 0 ]]; then
  [ -f "artifacts/admin-panel/dist/public/index.html" ] || fail "Admin dist/public/index.html not found. Run: BASE_PATH=/admin/ NODE_ENV=production pnpm --filter @workspace/admin-panel run build"
  grep -qE 'src="/admin/assets/|href="/admin/assets/' "artifacts/admin-panel/dist/public/index.html" || fail "Admin dist/index.html was built without BASE_PATH=/admin/. Assets will 404 on /admin/. Rebuild with: BASE_PATH=/admin/ NODE_ENV=production pnpm --filter @workspace/admin-panel run build"
fi

log "Pre-flight OK"

# ════════════════════════════════════════════════════════════════════════════
# 2. BACKUP CRITICAL FILES (on VPS)
# ════════════════════════════════════════════════════════════════════════════
if [[ "$SKIP_API" -eq 0 ]]; then
  log "Creating API backup..."
  ssh_vps "cp /opt/debryansk/api/index.mjs /opt/debryansk/api/index.mjs.bak.\$(date +%s) 2>/dev/null || true"
fi

# ════════════════════════════════════════════════════════════════════════════
# 3. TRANSFER API (atomically — all files together)
# ════════════════════════════════════════════════════════════════════════════
if [[ "$SKIP_API" -eq 0 ]]; then
  log "Uploading API dist..."
  cd artifacts/api-server
  tar czf - \
    dist/index.mjs \
    dist/geo-citation-check.mjs \
    dist/pino-worker.mjs \
    dist/pino-file.mjs \
    dist/pino-pretty.mjs \
    dist/thread-stream-worker.mjs \
    dist/kp-template.html \
    dist/logo-da.svg \
  | sshpass -p "$VPS_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_HOST" \
    "tar xzf - -C /opt/debryansk/api/ --strip-components=1"
  cd ../..
  log "API uploaded"

  # Sync scripts (prerender + ssg + node_modules symlink)
  log "Syncing scripts..."
  ssh_vps "mkdir -p /opt/debryansk/scripts /opt/debryansk/api/scripts"
  sshpass -p "$VPS_SSH_PASSWORD" scp -o StrictHostKeyChecking=no \
    artifacts/api-server/scripts/prerender.mjs \
    "$VPS_HOST:/opt/debryansk/scripts/prerender.mjs"
  sshpass -p "$VPS_SSH_PASSWORD" scp -o StrictHostKeyChecking=no \
    artifacts/api-server/scripts/prerender.mjs \
    "$VPS_HOST:/opt/debryansk/api/scripts/prerender.mjs"
  sshpass -p "$VPS_SSH_PASSWORD" scp -o StrictHostKeyChecking=no \
    artifacts/debryansk-avto/scripts/ssg.mjs \
    "$VPS_HOST:/opt/debryansk/scripts/ssg.mjs"
  ssh_vps "if [ -d /opt/debryansk/scripts/node_modules ] && [ ! -L /opt/debryansk/scripts/node_modules ]; then rm -rf /opt/debryansk/scripts/node_modules; fi; ln -sfn /opt/debryansk/api/node_modules /opt/debryansk/scripts/node_modules"
  log "Scripts synced"
fi

# ════════════════════════════════════════════════════════════════════════════
# 4. TRANSFER FRONTEND
# ════════════════════════════════════════════════════════════════════════════
if [[ "$SKIP_FRONTEND" -eq 0 ]]; then
  log "Uploading frontend..."
  # Clear news SSG pages first — articles created via admin panel exist only in VPS DB,
  # not in Replit DB used at build time. Without clearing, old pages with stale JS hashes
  # persist across deploys and cause browsers to load outdated code bundles.
  ssh_vps "rm -rf /opt/debryansk/frontend/news/"
  cd artifacts/debryansk-avto
  tar czf - dist/public/ | sshpass -p "$VPS_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_HOST" \
    "tar xzf - -C /opt/debryansk/frontend/ --strip-components=2"
  cd ../..
  log "Frontend uploaded"
fi

# ════════════════════════════════════════════════════════════════════════════
# 5. TRANSFER ADMIN PANEL
# ════════════════════════════════════════════════════════════════════════════
if [[ "$SKIP_ADMIN" -eq 0 ]]; then
  log "Uploading admin panel..."
  cd artifacts/admin-panel
  tar czf - dist/public/ | sshpass -p "$VPS_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_HOST" \
    "mkdir -p /opt/debryansk/admin && tar xzf - -C /opt/debryansk/admin/ --strip-components=2"
  cd ../..
  log "Admin uploaded"
fi

# ════════════════════════════════════════════════════════════════════════════
# 6. TRANSFER UPLOADS (logos, static assets)
# ════════════════════════════════════════════════════════════════════════════
log "Syncing static uploads..."
cd artifacts/api-server
tar czf - uploads/ | sshpass -p "$VPS_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_HOST" \
  "tar xzf - -C /opt/debryansk/ --strip-components=0"
cd ../..
log "Uploads synced"

# ════════════════════════════════════════════════════════════════════════════
# 7. POST-TRANSFER VERIFY (on VPS)
# ════════════════════════════════════════════════════════════════════════════
log "Verifying deployed files..."

ssh_vps "
  ERRORS=0
  [ -f /opt/debryansk/api/index.mjs ]      || { echo 'MISSING: api/index.mjs'; ERRORS=1; }
  [ -f /opt/debryansk/frontend/index.html ] || { echo 'MISSING: frontend/index.html'; ERRORS=1; }
  [ -f /opt/debryansk/admin/index.html ]    || { echo 'MISSING: admin/index.html'; ERRORS=1; }
  exit \$ERRORS
" || fail "File verification failed — some files missing on VPS. See output above."

log "File verification OK"

# ════════════════════════════════════════════════════════════════════════════
# 8. RESTART PM2 (only after ALL files transferred)
# ════════════════════════════════════════════════════════════════════════════
log "Restarting PM2..."
ssh_vps "pm2 restart debryansk-avto && pm2 save"
log "PM2 restarted"

# ════════════════════════════════════════════════════════════════════════════
# 9. HEALTH CHECK
# ════════════════════════════════════════════════════════════════════════════
log "Waiting 5s for startup..."
sleep 5

API_OK=$(ssh_vps "curl -sf http://localhost:8080/api/brands 2>/dev/null | head -c 50 || echo FAIL")
if echo "$API_OK" | grep -q '"ok":true'; then
  log "✓ API health check OK"
else
  log "✗ API health check failed: $API_OK"
  log "  Checking error logs..."
  ssh_vps "tail -20 /root/.pm2/logs/debryansk-avto-error.log"
  fail "API not responding after restart"
fi

FRONT_OK=$(ssh_vps "curl -sf http://localhost:8080/ 2>/dev/null | head -c 30 || echo FAIL")
if echo "$FRONT_OK" | grep -q '<!DOCTYPE html'; then
  log "✓ Frontend serving OK"
else
  log "✗ Frontend serving failed: $FRONT_OK"
  fail "Frontend not serving after restart"
fi

# ════════════════════════════════════════════════════════════════════════════
# 10. DONE
# ════════════════════════════════════════════════════════════════════════════
log "=== Deploy complete === $(date)"
