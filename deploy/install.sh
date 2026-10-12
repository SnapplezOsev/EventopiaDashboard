#!/usr/bin/env bash
# ============================================================================
# Eventopia Dashboard — Installationsscript för Arch Linux
# ============================================================================
# Kör detta EN gång på NUC:en. Det:
#   1. Installerar Node.js, npm, git, chromium
#   2. Frågar efter Rentman API-nyckel
#   3. Bygger appen
#   4. Skapar systemd-tjänster (dashboard + auto-uppdatering + kiosk)
#   5. Startar allt automatiskt
#
# Användning:
#   curl -sL <raw-github-url>/deploy/install.sh | bash
#   — eller —
#   git clone <repo> && cd EventopiaDashboard && bash deploy/install.sh
# ============================================================================

set -euo pipefail

# --- Konfiguration ---
APP_NAME="eventopia-dashboard"
APP_DIR="/opt/eventopia-dashboard"
APP_USER="eventopia"
GITHUB_REPO=""  # Fylls i av användaren om det inte redan är ett git-repo
UPDATE_INTERVAL="5min"

# --- Färger ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✔${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✖${NC}  $*" >&2; }

header() {
    echo ""
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}  $*${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# --- Kontrollera root ---
if [[ $EUID -ne 0 ]]; then
    error "Kör detta script som root: sudo bash deploy/install.sh"
    exit 1
fi

header "Eventopia Dashboard — Installation"

# ============================================================================
# STEG 1: Installera system-paket
# ============================================================================
header "Steg 1/6 — Installerar systempaket"

info "Uppdaterar pacman..."
pacman -Syu --noconfirm

PACKAGES=(nodejs npm git chromium xorg-server xorg-xinit xorg-xset)
for pkg in "${PACKAGES[@]}"; do
    if pacman -Qi "$pkg" &>/dev/null; then
        success "$pkg redan installerat"
    else
        info "Installerar $pkg..."
        pacman -S --noconfirm "$pkg"
        success "$pkg installerat"
    fi
done

# Verifiera Node.js
NODE_VERSION=$(node --version 2>/dev/null || echo "none")
info "Node.js version: $NODE_VERSION"

# ============================================================================
# STEG 2: Skapa app-användare
# ============================================================================
header "Steg 2/6 — Skapar app-användare"

if id "$APP_USER" &>/dev/null; then
    success "Användare '$APP_USER' finns redan"
else
    useradd -r -m -s /bin/bash -d /home/$APP_USER "$APP_USER"
    success "Användare '$APP_USER' skapad"
fi

# Lägg till i video-gruppen för skärmåtkomst
usermod -aG video "$APP_USER" 2>/dev/null || true
usermod -aG input "$APP_USER" 2>/dev/null || true

# ============================================================================
# STEG 3: Klona/kopiera projekt
# ============================================================================
header "Steg 3/6 — Konfigurerar projekt"

# Kolla om vi redan är i ett git-repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ -d "$PROJECT_ROOT/.git" ]]; then
    info "Kör från existerande git-repo: $PROJECT_ROOT"
    
    if [[ "$PROJECT_ROOT" != "$APP_DIR" ]]; then
        info "Kopierar projekt till $APP_DIR..."
        mkdir -p "$APP_DIR"
        rsync -a --exclude='node_modules' --exclude='.next' "$PROJECT_ROOT/" "$APP_DIR/"
        success "Projekt kopierat till $APP_DIR"
    fi
    
    # Hämta remote URL
    GITHUB_REPO=$(cd "$PROJECT_ROOT" && git remote get-url origin 2>/dev/null || echo "")
else
    # Fråga efter repo-URL
    echo ""
    echo -e "${BOLD}Ange GitHub-repo URL:${NC}"
    echo -e "  (t.ex. https://github.com/ditt-konto/EventopiaDashboard.git)"
    read -rp "  > " GITHUB_REPO
    
    if [[ -z "$GITHUB_REPO" ]]; then
        error "Ingen repo-URL angiven. Avbryter."
        exit 1
    fi
    
    info "Klonar repo..."
    git clone "$GITHUB_REPO" "$APP_DIR"
    success "Repo klonat till $APP_DIR"
fi

cd "$APP_DIR"

# Spara repo-URL för auto-uppdatering
echo "$GITHUB_REPO" > "$APP_DIR/.github-repo-url"

# ============================================================================
# STEG 4: Konfigurera API-nyckel
# ============================================================================
header "Steg 4/6 — Konfigurerar Rentman API"

if [[ -f "$APP_DIR/.env.local" ]]; then
    CURRENT_TOKEN=$(grep "^RENTMAN_API_TOKEN=" "$APP_DIR/.env.local" 2>/dev/null | cut -d'=' -f2-)
    if [[ -n "$CURRENT_TOKEN" && "$CURRENT_TOKEN" != "your_rentman_api_token_here" ]]; then
        warn "En API-nyckel finns redan konfigurerad."
        echo -e "  Nuvarande nyckel (sista 20 tecken): ...${CURRENT_TOKEN: -20}"
        read -rp "  Vill du byta den? (j/N): " CHANGE_KEY
        if [[ "${CHANGE_KEY,,}" != "j" && "${CHANGE_KEY,,}" != "y" ]]; then
            success "Behåller befintlig API-nyckel"
            SKIP_KEY=true
        fi
    fi
fi

if [[ "${SKIP_KEY:-}" != "true" ]]; then
    echo ""
    echo -e "${BOLD}Ange din Rentman API-nyckel:${NC}"
    echo -e "  (Hittas i Rentman → Konfiguration → API)"
    echo ""
    read -rp "  API-nyckel: " API_TOKEN
    
    if [[ -z "$API_TOKEN" ]]; then
        error "Ingen API-nyckel angiven. Avbryter."
        exit 1
    fi
    
    # Skapa .env.local från template
    cp "$APP_DIR/.env.local.example" "$APP_DIR/.env.local"
    sed -i "s|your_rentman_api_token_here|${API_TOKEN}|" "$APP_DIR/.env.local"
    success "API-nyckel sparad i .env.local"
fi

# Sätt rätt ägare
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ============================================================================
# STEG 5: Bygg appen
# ============================================================================
header "Steg 5/6 — Bygger appen"

info "Installerar npm-paket..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci --production=false"
success "npm-paket installerade"

info "Bygger Next.js (standalone)..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm run build"
success "App byggd!"

# Kopiera static + public till standalone
if [[ -d "$APP_DIR/.next/standalone" ]]; then
    cp -r "$APP_DIR/public" "$APP_DIR/.next/standalone/public" 2>/dev/null || true
    cp -r "$APP_DIR/.next/static" "$APP_DIR/.next/standalone/.next/static" 2>/dev/null || true
    success "Static-filer kopierade till standalone"
fi

# ============================================================================
# STEG 6: Systemd-tjänster
# ============================================================================
header "Steg 6/6 — Skapar systemd-tjänster"

# --- Dashboard-tjänst ---
cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=Eventopia Dashboard (Next.js)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env.local
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/node ${APP_DIR}/.next/standalone/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

[Install]
WantedBy=multi-user.target
EOF
success "Dashboard-tjänst skapad"

# --- Auto-uppdaterare ---
cat > /etc/systemd/system/${APP_NAME}-updater.service << EOF
[Unit]
Description=Eventopia Dashboard Auto-Updater
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
ExecStart=${APP_DIR}/deploy/update.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}-updater
EOF

cat > /etc/systemd/system/${APP_NAME}-updater.timer << EOF
[Unit]
Description=Kolla efter Eventopia Dashboard-uppdateringar

[Timer]
OnBootSec=2min
OnUnitActiveSec=${UPDATE_INTERVAL}
RandomizedDelaySec=30

[Install]
WantedBy=timers.target
EOF
success "Auto-uppdaterings-tjänst och timer skapad (var ${UPDATE_INTERVAL})"

# --- Chromium Kiosk ---
cat > /etc/systemd/system/${APP_NAME}-kiosk.service << EOF
[Unit]
Description=Eventopia Dashboard Kiosk (Chromium)
After=${APP_NAME}.service
Wants=${APP_NAME}.service
After=graphical.target

[Service]
Type=simple
User=${APP_USER}
Environment=DISPLAY=:0
ExecStartPre=/usr/bin/sleep 5
ExecStart=/usr/bin/chromium \\
    --kiosk \\
    --no-first-run \\
    --disable-translate \\
    --disable-infobars \\
    --disable-suggestions-service \\
    --disable-save-password-bubble \\
    --disable-session-crashed-bubble \\
    --noerrdialogs \\
    --check-for-update-interval=31536000 \\
    --touch-events=enabled \\
    --enable-touch-drag-drop \\
    --disable-pinch \\
    --overscroll-history-navigation=0 \\
    --start-fullscreen \\
    --autoplay-policy=no-user-gesture-required \\
    http://localhost:3000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}-kiosk

[Install]
WantedBy=graphical.target
EOF
success "Kiosk-tjänst skapad"

# --- Sätt touchscreen-konfiguration ---
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/99-touchscreen.conf << EOF
# Aktivera touch-input för Google Jamboard
Section "InputClass"
    Identifier "Touchscreen"
    MatchIsTouchscreen "on"
    Driver "libinput"
    Option "TouchDragLock" "true"
    Option "Tapping" "true"
EndSection
EOF
success "Touchscreen X11-konfiguration skapad"

# --- Aktivera tjänster ---
systemctl daemon-reload
systemctl enable --now ${APP_NAME}.service
systemctl enable --now ${APP_NAME}-updater.timer
success "Dashboard och auto-uppdatering aktiverade"

echo ""
echo -e "${YELLOW}⚠  Kiosk-tjänsten är INTE aktiverad automatiskt.${NC}"
echo -e "   Aktivera den när du är redo med touch-skärmen:"
echo -e "   ${BOLD}sudo systemctl enable --now ${APP_NAME}-kiosk.service${NC}"

# ============================================================================
# KLAR!
# ============================================================================
header "Installation klar!"

echo -e "  ${GREEN}Dashboard körs nu på:${NC}  ${BOLD}http://localhost:3000${NC}"
echo ""
echo -e "  ${CYAN}Användbara kommandon:${NC}"
echo -e "  ┌─────────────────────────────────────────────────────────────────┐"
echo -e "  │ Se status:          sudo systemctl status ${APP_NAME}          │"
echo -e "  │ Se loggar:          sudo journalctl -u ${APP_NAME} -f          │"
echo -e "  │ Starta om:          sudo systemctl restart ${APP_NAME}         │"
echo -e "  │ Tvinga uppdatering: sudo ${APP_DIR}/deploy/update.sh           │"
echo -e "  │ Byta API-nyckel:    sudo bash ${APP_DIR}/deploy/configure.sh   │"
echo -e "  │ Starta kiosk:       sudo systemctl enable --now ${APP_NAME}-kiosk │"
echo -e "  └─────────────────────────────────────────────────────────────────┘"
echo ""
