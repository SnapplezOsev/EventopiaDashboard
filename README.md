# Eventopia Dashboard — Rentman Touch Dashboard

Operativ veckoöversikt för touch-TV (Google Jamboard) driven av Intel NUC.  
Hämtar data från **Rentman API** och visar schema, crew-tilldelning, tasks och möten.

---

## Snabbstart — Arch Linux (NUC + Jamboard)

### 1. Klona och installera (en gång)
```bash
git clone https://github.com/<ditt-konto>/EventopiaDashboard.git
cd EventopiaDashboard
sudo bash deploy/install.sh
```

Installationsscriptet:
- Installerar Node.js, npm, git, Chromium
- Frågar efter din **Rentman API-nyckel**
- Bygger appen
- Skapar systemd-tjänster (dashboard + auto-uppdatering)

### 2. Klart! 🎉
Dashboarden körs nu på `http://localhost:3000` och startar automatiskt vid omstart.

---

## Auto-uppdatering

Var 5:e minut kollar NUC:en GitHub för nya commits. Om du pushar en uppdatering:

```
Du pushar till GitHub → NUC:en upptäcker → Pullar → Bygger om → Startar om
```

Ingen manuell åtgärd behövs. Tvinga manuell uppdatering:
```bash
sudo /opt/eventopia-dashboard/deploy/update.sh
```

---

## Hantera API-nyckel & inställningar

```bash
sudo bash /opt/eventopia-dashboard/deploy/configure.sh
```

Interaktiv meny för att:
- Byta Rentman API-nyckel
- Ändra API Base URL
- Konfigurera projektstatusar och personalmappar

---

## Användbara kommandon

| Kommando | Beskrivning |
|---|---|
| `sudo systemctl status eventopia-dashboard` | Se dashboard-status |
| `sudo journalctl -u eventopia-dashboard -f` | Följ loggar live |
| `sudo systemctl restart eventopia-dashboard` | Starta om |
| `sudo systemctl status eventopia-dashboard-updater.timer` | Auto-update status |
| `sudo systemctl enable --now eventopia-dashboard-kiosk` | Starta kiosk-läge |

---

## Lokal utveckling (Windows/Mac)

```bash
npm install
cp .env.local.example .env.local
# Redigera .env.local med din API-nyckel
npm run dev
```

---

## Techstack

- **Next.js 16** (App Router, standalone output)
- **React 19**
- **Tailwind CSS 4**
- **Rentman REST API**
- **systemd** (process management + auto-update timer)
- **Chromium kiosk** (touch-fullscreen)
