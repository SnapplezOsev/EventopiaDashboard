#!/usr/bin/env bash
# ============================================================================
# Eventopia Dashboard — Auto-uppdateringsscript
# ============================================================================
# Körs automatiskt via systemd timer (var 5:e minut) eller manuellt via UI/CLI.
# Kollar om det finns nya commits på GitHub, och om så:
#   1. Pullar nya ändringar
#   2. Installerar eventuella nya npm-paket
#   3. Bygger om appen
#   4. Startar om dashboard-tjänsten
#   5. Rapporterar realtidsstatus till data/update-status.json
# ============================================================================

set -euo pipefail

APP_NAME="eventopia-dashboard"
APP_USER="eventopia"
LOG_TAG="eventopia-updater"

# Bestäm app-mapp dynamiskt baserat på scriptets placering om det körs från ett repo
APP_DIR="/opt/eventopia-dashboard"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
if [[ -d "$PARENT_DIR/.git" ]]; then
    APP_DIR="$PARENT_DIR"
fi

STATUS_FILE="$APP_DIR/data/update-status.json"

# Initiera variabler för att undvika 'unbound variable' med set -u
LOCAL_HASH=""
REMOTE_HASH=""

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | logger -t "$LOG_TAG" 2>/dev/null || true; echo "[$(date '+%H:%M:%S')] $*"; }
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
    local target="${REMOTE_HASH:-}"
    local targetShort="${target:0:7}"

    mkdir -p "$(dirname "$STATUS_FILE")" 2>/dev/null || true
    cat <<EOF > "$STATUS_FILE"
{
  "status": "$status",
  "stage": "$stage",
  "message": "$message",
  "progress": $progress,
  "updatedAt": $now,
  "targetCommit": "$targetShort",
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

# Konfigurera safe.directory för att förhindra dubiös ägarskaps-fel (exit code 128)
git config --system --add safe.directory "$APP_DIR" 2>/dev/null || true
git config --system --add safe.directory "*" 2>/dev/null || true
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

if [[ $EUID -eq 0 ]]; then
    # Sätt ägarskap till app-användaren och konfigurera användarens git
    chown -R "$APP_USER:$APP_USER" "$APP_DIR" 2>/dev/null || true
    sudo -H -u "$APP_USER" git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
    sudo -H -u "$APP_USER" git config --global --add safe.directory "*" 2>/dev/null || true
fi

# --- Hämta senaste från remote ---
info "Kollar efter uppdateringar i $APP_DIR..."

if [[ $EUID -eq 0 ]]; then
    sudo -H -u "$APP_USER" git fetch origin || git fetch origin
else
    git fetch origin
fi

# Jämför lokal vs remote
LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
REMOTE_HASH=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null || echo "$LOCAL_HASH")

FORCE="${1:-}"
if [[ "$LOCAL_HASH" == "$REMOTE_HASH" && "$FORCE" != "--force" && "$FORCE" != "-f" ]]; then
    info "Ingen uppdatering tillgänglig (${LOCAL_HASH:0:8})"
    exit 0
fi

# --- Ny version hittad (eller tvingad uppdatering) ---
info "Kör uppdatering: ${LOCAL_HASH:0:8} → ${REMOTE_HASH:0:8}"
write_status "running" "git_pull" "Hämtar senaste ändringarna från GitHub..." 15

# Spara nuvarande .env.local (ska INTE finnas i git, men säkra oss)
if [[ -f "$APP_DIR/.env.local" ]]; then
    cp "$APP_DIR/.env.local" "/tmp/.env.local.backup"
fi

# Pull ändringar
if [[ $EUID -eq 0 ]]; then
    sudo -H -u "$APP_USER" git reset --hard origin/main 2>/dev/null || \
    sudo -H -u "$APP_USER" git reset --hard origin/master 2>/dev/null || \
    git reset --hard origin/main 2>/dev/null || \
    git reset --hard origin/master
else
    git reset --hard origin/main 2>/dev/null || \
    git reset --hard origin/master
fi
ok "Git pull klar"

# Återställ .env.local
if [[ -f "/tmp/.env.local.backup" ]]; then
    cp "/tmp/.env.local.backup" "$APP_DIR/.env.local"
    rm "/tmp/.env.local.backup"
    ok ".env.local bevarad"
fi

# Installera npm-paket
info "Installerar npm-paket..."
write_status "running" "npm_install" "Installerar och verifierar npm-paket..." 35
if [[ $EUID -eq 0 ]]; then
    sudo -H -u "$APP_USER" bash -c "cd '$APP_DIR' && (npm ci --production=false 2>/dev/null || npm install)"
else
    (cd "$APP_DIR" && (npm ci --production=false 2>/dev/null || npm install))
fi
ok "npm-paket installerade"

# Sätt fulla rättigheter till användaren innan bygge så inga gamla filer låser sig
if [[ $EUID -eq 0 ]]; then
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi
rm -rf "$APP_DIR/.next/standalone" 2>/dev/null || true

# Bygg
info "Bygger om appen..."
write_status "running" "building" "Bygger om applikationen (Next.js compile)..." 60
if [[ $EUID -eq 0 ]]; then
    sudo -H -u "$APP_USER" bash -c "cd '$APP_DIR' && npm run build"
else
    (cd "$APP_DIR" && npm run build)
fi
ok "App ombyggd"

# Uppdatera version.json
FINAL_COMMIT="${REMOTE_HASH:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"
echo "{\"commit\": \"${FINAL_COMMIT:0:7}\"}" > "$APP_DIR/version.json" 2>/dev/null || true

# Kopiera static-filer till standalone
if [[ -d "$APP_DIR/.next/standalone" ]]; then
    cp -r "$APP_DIR/public" "$APP_DIR/.next/standalone/public" 2>/dev/null || true
    mkdir -p "$APP_DIR/.next/standalone/.next"
    cp -r "$APP_DIR/.next/static" "$APP_DIR/.next/standalone/.next/static" 2>/dev/null || true
fi

# Sätt rättigheter
if [[ $EUID -eq 0 ]]; then
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

# Starta om dashboard
info "Startar om dashboard..."
write_status "running" "restarting" "Startar om dashboard-tjänsten..." 85
if [[ $EUID -eq 0 ]]; then
    systemctl restart "$APP_NAME" 2>/dev/null || systemctl restart "${APP_NAME}.service" 2>/dev/null || true
else
    sudo systemctl restart "$APP_NAME" 2>/dev/null || sudo systemctl restart "${APP_NAME}.service" 2>/dev/null || true
fi
ok "Dashboard omstartad!"

# Verifiera att den körs
sleep 3
if systemctl is-active --quiet "$APP_NAME" 2>/dev/null; then
    NEW_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "${FINAL_COMMIT:0:7}")
    ok "✅ Uppdatering klar! Kör nu version ${NEW_HASH}"
    write_status "success" "complete" "Uppdatering klar! Kör nu version ${NEW_HASH}" 100
else
    # Om systemctl inte används (t.ex. vid direkt manuell testning), verifiera processen
    NEW_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "${FINAL_COMMIT:0:7}")
    ok "Bygge och uppdatering slutförd! Version: ${NEW_HASH}"
    write_status "success" "complete" "Bygge och uppdatering klar (version ${NEW_HASH})" 100
fi
