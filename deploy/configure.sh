#!/usr/bin/env bash
# ============================================================================
# Eventopia Dashboard — Konfigurationsscript
# ============================================================================
# Interaktivt script för att byta API-nyckel och andra inställningar.
#
# Användning:  sudo bash deploy/configure.sh
# ============================================================================

set -euo pipefail

APP_NAME="eventopia-dashboard"
APP_DIR="/opt/eventopia-dashboard"
ENV_FILE="$APP_DIR/.env.local"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Om scriptet körs från repo-mappen (inte /opt)
if [[ ! -f "$ENV_FILE" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    APP_DIR="$(dirname "$SCRIPT_DIR")"
    ENV_FILE="$APP_DIR/.env.local"
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}Kunde inte hitta .env.local${NC}"
    echo "Förväntad plats: $ENV_FILE"
    exit 1
fi

echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}${BOLD}  Eventopia Dashboard — Konfiguration${NC}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# --- Visa nuvarande konfiguration ---
echo -e "${BOLD}Nuvarande konfiguration:${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CURRENT_TOKEN=$(grep "^RENTMAN_API_TOKEN=" "$ENV_FILE" | cut -d'=' -f2-)
CURRENT_BASE_URL=$(grep "^RENTMAN_API_BASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)
CURRENT_STATUSES=$(grep "^DASHBOARD_PROJECT_STATUSES=" "$ENV_FILE" | cut -d'=' -f2-)
CURRENT_INTERNAL=$(grep "^DASHBOARD_INTERNAL_FOLDERS=" "$ENV_FILE" | cut -d'=' -f2-)
CURRENT_FREELANCER=$(grep "^DASHBOARD_FREELANCER_FOLDERS=" "$ENV_FILE" | cut -d'=' -f2-)

if [[ -n "$CURRENT_TOKEN" ]]; then
    TOKEN_PREVIEW="...${CURRENT_TOKEN: -20}"
else
    TOKEN_PREVIEW="(ej konfigurerad)"
fi

echo -e "  API-nyckel:            ${TOKEN_PREVIEW}"
echo -e "  API Base URL:          ${CURRENT_BASE_URL:-https://api.rentman.net}"
echo -e "  Projektstatus-filter:  ${CURRENT_STATUSES:-1,3,4,5}"
echo -e "  Interna mappar:        ${CURRENT_INTERNAL:-40}"
echo -e "  Frilans-mappar:        ${CURRENT_FREELANCER:-41,43}"
echo ""

# --- Meny ---
echo -e "${BOLD}Vad vill du ändra?${NC}"
echo ""
echo "  1) Byta Rentman API-nyckel"
echo "  2) Ändra API Base URL"
echo "  3) Ändra projektstatusar"
echo "  4) Ändra personalmappar"
echo "  5) Visa hela .env.local"
echo "  0) Avsluta"
echo ""
read -rp "  Val: " CHOICE

case "$CHOICE" in
    1)
        echo ""
        echo -e "${BOLD}Ange ny Rentman API-nyckel:${NC}"
        read -rp "  > " NEW_TOKEN
        if [[ -z "$NEW_TOKEN" ]]; then
            echo -e "${RED}Ingen nyckel angiven. Avbryter.${NC}"
            exit 1
        fi
        sed -i "s|^RENTMAN_API_TOKEN=.*|RENTMAN_API_TOKEN=${NEW_TOKEN}|" "$ENV_FILE"
        echo -e "${GREEN}✔ API-nyckel uppdaterad!${NC}"
        ;;
    2)
        echo ""
        echo -e "Nuvarande: ${CURRENT_BASE_URL:-https://api.rentman.net}"
        echo -e "${BOLD}Ange ny API Base URL:${NC}"
        read -rp "  > " NEW_URL
        if [[ -n "$NEW_URL" ]]; then
            sed -i "s|^RENTMAN_API_BASE_URL=.*|RENTMAN_API_BASE_URL=${NEW_URL}|" "$ENV_FILE"
            echo -e "${GREEN}✔ API Base URL uppdaterad!${NC}"
        fi
        ;;
    3)
        echo ""
        echo -e "Nuvarande: ${CURRENT_STATUSES:-1,3,4,5}"
        echo -e "${BOLD}Ange nya projektstatusar (kommaseparerade):${NC}"
        read -rp "  > " NEW_STATUSES
        if [[ -n "$NEW_STATUSES" ]]; then
            sed -i "s|^DASHBOARD_PROJECT_STATUSES=.*|DASHBOARD_PROJECT_STATUSES=${NEW_STATUSES}|" "$ENV_FILE"
            echo -e "${GREEN}✔ Projektstatusar uppdaterade!${NC}"
        fi
        ;;
    4)
        echo ""
        echo -e "Interna mappar:  ${CURRENT_INTERNAL:-40}"
        echo -e "Frilans-mappar:  ${CURRENT_FREELANCER:-41,43}"
        echo ""
        echo -e "${BOLD}Ange nya interna mapp-ID:n (kommaseparerade):${NC}"
        read -rp "  > " NEW_INTERNAL
        echo -e "${BOLD}Ange nya frilans mapp-ID:n (kommaseparerade):${NC}"
        read -rp "  > " NEW_FREELANCER
        if [[ -n "$NEW_INTERNAL" ]]; then
            sed -i "s|^DASHBOARD_INTERNAL_FOLDERS=.*|DASHBOARD_INTERNAL_FOLDERS=${NEW_INTERNAL}|" "$ENV_FILE"
        fi
        if [[ -n "$NEW_FREELANCER" ]]; then
            sed -i "s|^DASHBOARD_FREELANCER_FOLDERS=.*|DASHBOARD_FREELANCER_FOLDERS=${NEW_FREELANCER}|" "$ENV_FILE"
        fi
        echo -e "${GREEN}✔ Personalmappar uppdaterade!${NC}"
        ;;
    5)
        echo ""
        echo -e "${BOLD}Innehåll i .env.local:${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        cat "$ENV_FILE"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        exit 0
        ;;
    0)
        echo "Avslutar."
        exit 0
        ;;
    *)
        echo -e "${RED}Ogiltigt val.${NC}"
        exit 1
        ;;
esac

# --- Fråga om restart ---
echo ""
read -rp "Vill du starta om dashboarden nu? (J/n): " RESTART
if [[ "${RESTART,,}" != "n" ]]; then
    if systemctl is-active --quiet "$APP_NAME" 2>/dev/null; then
        systemctl restart "$APP_NAME"
        echo -e "${GREEN}✔ Dashboard omstartad!${NC}"
    else
        echo -e "${YELLOW}⚠ Dashboard-tjänsten körs inte. Starta med: sudo systemctl start $APP_NAME${NC}"
    fi
fi

echo ""
