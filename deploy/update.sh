#!/usr/bin/env bash
# ============================================================================
# Eventopia Dashboard — Auto-uppdateringsscript
# ============================================================================
# Körs automatiskt via systemd timer (var 5:e minut) eller manuellt via UI.
# Kollar om det finns nya commits på GitHub, och om så:
#   1. Pullar nya ändringar
#   2. Installerar eventuella nya npm-paket
#   3. Bygger om appen
#   4. Startar om dashboard-tjänsten
#   5. Rapporterar realtidsstatus till data/update-status.json
# ============================================================================

set -euo pipefail

APP_NAME="eventopia-dashboard"
APP_DIR="/opt/eventopia-dashboard"
APP_USER="eventopia"
LOG_TAG="eventopia-updater"
STATUS_FILE="$APP_DIR/data/update-status.json"

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | logger -t "$LOG_TAG"; echo "[$(date '+%H:%M:%S')] $*"; }
info() { log "ℹ  $*"; }
ok()   { log "✔  $*"; }
err()  { log "✖  $*" >&2; }

write_status() {
    local status="$1"
    local stage="$2"
    local message="$3"
    local progress="$4"
    local error="${5:-}"
    local now
    now=$(date +%s%3N 2>/dev/null || echo "$(date +%s)000")

    mkdir -p "$(dirname "$STATUS_FILE")" 2>/dev/null || true
    cat <<EOF > "$STATUS_FILE"
{
  "status": "$status",
  "stage": "$stage",
  "message": "$message",
  "progress": $progress,
  "updatedAt": $now,
  "targetCommit": "${REMOTE_HASH:0:7}",
  "error": $(if [[ -n "$error" ]]; then echo "\"$error\""; else echo "null"; fi)
}
EOF
    chown "$APP_USER:$APP_USER" "$STATUS_FILE" 2>/dev/null || true
}

on_error() {
    local exit_code="$1"
    local line_no="$2"
    err "Uppdatering avbröts med felkod $exit_code på rad $line_no"
    write_status "error" "failed" "Uppdateringen misslyckades vid rad $line_no (felkod $exit_code)" 0 "Fel på rad $line_no i update.sh"
    exit "$exit_code"
}
trap 'on_error $? $LINENO' ERR

# --- Säkerhetskontroll ---
if [[ ! -d "$APP_DIR/.git" ]]; then
    err "Inget git-repo i $APP_DIR — kan inte uppdatera."
    write_status "error" "failed" "Inget git-repo i $APP_DIR" 0 "Git repo saknas"
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

FORCE="${1:-}"
if [[ "$LOCAL_HASH" == "$REMOTE_HASH" && "$FORCE" != "--force" && "$FORCE" != "-f" ]]; then
    info "Ingen uppdatering tillgänglig (${LOCAL_HASH:0:8})"
    exit 0
fi

# --- Ny version hittad! ---
info "Ny version hittad! ${LOCAL_HASH:0:8} → ${REMOTE_HASH:0:8}"
info "Uppdaterar..."
write_status "running" "git_pull" "Hämtar senaste ändringarna från GitHub..." 15

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
write_status "running" "npm_install" "Installerar och verifierar npm-paket..." 35
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci --production=false"
ok "npm-paket installerade"

# Sätt fulla rättigheter till användaren innan bygge så inga gamla filer låser sig
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
rm -rf "$APP_DIR/.next/standalone" 2>/dev/null || true

# Bygg
info "Bygger om appen..."
write_status "running" "building" "Bygger om applikationen (Next.js compile)..." 60
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm run build"
ok "App ombyggd"

# Uppdatera version.json
echo "{\"commit\": \"${REMOTE_HASH:0:7}\"}" > "$APP_DIR/version.json" 2>/dev/null || true

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
write_status "running" "restarting" "Startar om dashboard-tjänsten..." 85
systemctl restart "$APP_NAME"
ok "Dashboard omstartad!"

# Verifiera att den körs
sleep 3
if systemctl is-active --quiet "$APP_NAME"; then
    NEW_HASH=$(git rev-parse --short HEAD)
    ok "✅ Uppdatering klar! Kör nu version ${NEW_HASH}"
    write_status "success" "complete" "Uppdatering klar! Kör nu version ${NEW_HASH}" 100
else
    err "Dashboard startade inte korrekt efter uppdatering!"
    err "Kolla loggar: journalctl -u $APP_NAME -n 50"
    write_status "error" "failed" "Dashboard startade inte korrekt efter omstart" 0 "systemctl is-active failed"
    exit 1
fi
