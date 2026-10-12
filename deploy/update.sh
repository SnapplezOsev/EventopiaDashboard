#!/usr/bin/env bash
# ============================================================================
# Eventopia Dashboard — Auto-uppdateringsscript
# ============================================================================
# Körs automatiskt via systemd timer (var 5:e minut).
# Kollar om det finns nya commits på GitHub, och om så:
#   1. Pullar nya ändringar
#   2. Installerar eventuella nya npm-paket
#   3. Bygger om appen
#   4. Startar om dashboard-tjänsten
# ============================================================================

set -euo pipefail

APP_NAME="eventopia-dashboard"
APP_DIR="/opt/eventopia-dashboard"
APP_USER="eventopia"
LOG_TAG="eventopia-updater"

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | logger -t "$LOG_TAG"; echo "[$(date '+%H:%M:%S')] $*"; }
info() { log "ℹ  $*"; }
ok()   { log "✔  $*"; }
err()  { log "✖  $*" >&2; }

# --- Säkerhetskontroll ---
if [[ ! -d "$APP_DIR/.git" ]]; then
    err "Inget git-repo i $APP_DIR — kan inte uppdatera."
    exit 1
fi

cd "$APP_DIR"

# --- Hämta senaste från remote ---
info "Kollar efter uppdateringar..."

# Hämta utan att merga
sudo -u "$APP_USER" git fetch origin 2>/dev/null

# Jämför lokal vs remote
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null || echo "unknown")

if [[ "$LOCAL_HASH" == "$REMOTE_HASH" ]]; then
    info "Ingen uppdatering tillgänglig (${LOCAL_HASH:0:8})"
    exit 0
fi

# --- Ny version hittad! ---
info "Ny version hittad! ${LOCAL_HASH:0:8} → ${REMOTE_HASH:0:8}"
info "Uppdaterar..."

# Spara nuvarande .env.local (ska INTE finnas i git, men säkra oss)
if [[ -f "$APP_DIR/.env.local" ]]; then
    cp "$APP_DIR/.env.local" "/tmp/.env.local.backup"
fi

# Pull ändringar
sudo -u "$APP_USER" git reset --hard origin/main 2>/dev/null || \
sudo -u "$APP_USER" git reset --hard origin/master 2>/dev/null
ok "Git pull klar"

# Återställ .env.local
if [[ -f "/tmp/.env.local.backup" ]]; then
    cp "/tmp/.env.local.backup" "$APP_DIR/.env.local"
    rm "/tmp/.env.local.backup"
    ok ".env.local bevarad"
fi

# Installera paket (bara om package-lock.json ändrats)
info "Installerar npm-paket..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci --production=false"
ok "npm-paket installerade"

# Bygg
info "Bygger om appen..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm run build"
ok "App ombyggd"

# Kopiera static-filer till standalone
if [[ -d "$APP_DIR/.next/standalone" ]]; then
    cp -r "$APP_DIR/public" "$APP_DIR/.next/standalone/public" 2>/dev/null || true
    mkdir -p "$APP_DIR/.next/standalone/.next"
    cp -r "$APP_DIR/.next/static" "$APP_DIR/.next/standalone/.next/static" 2>/dev/null || true
fi

# Sätt rättigheter
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Starta om dashboard
info "Startar om dashboard..."
systemctl restart "$APP_NAME"
ok "Dashboard omstartad!"

# Verifiera att den körs
sleep 3
if systemctl is-active --quiet "$APP_NAME"; then
    NEW_HASH=$(git rev-parse --short HEAD)
    ok "✅ Uppdatering klar! Kör nu version ${NEW_HASH}"
else
    err "Dashboard startade inte korrekt efter uppdatering!"
    err "Kolla loggar: journalctl -u $APP_NAME -n 50"
    exit 1
fi
