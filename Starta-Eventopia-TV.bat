@echo off
chcp 65001 >nul
title Eventopia Dashboard - Starta TV och Kiosk
color 0B

echo ======================================================================
echo           Eventopia Dashboard - Starta TV och Kiosk
echo ======================================================================
echo.

set "NUC_IP=192.168.1.185"
set "NUC_USER=eventopia"
set "KEY_PATH=%USERPROFILE%\.ssh\id_ed25519"

echo [1/3] Kontrollerar anslutning till NUC (%NUC_IP%)...
ping -n 1 -w 1000 %NUC_IP% >nul
if errorlevel 1 (
    color 0C
    echo [FEL] Kunde inte na NUC:en pa %NUC_IP%. Kontrollera att den ar igang.
    goto :end
)
echo [OK] NUC svarar pa natverket.

echo.
echo [2/3] Kontrollerar webbservern pa port 3000...
curl.exe --connect-timeout 3 -s -I http://%NUC_IP%:3000 | findstr "HTTP" >nul
if errorlevel 1 (
    echo [INFO] Webbservern svarar inte. Startar om bade server och kiosk...
    set "RESTART_CMD=sudo systemctl restart eventopia-dashboard; sudo systemctl restart eventopia-dashboard-kiosk"
) else (
    echo [OK] Webbservern kors redan!
    set "RESTART_CMD=sudo systemctl restart eventopia-dashboard-kiosk"
)

echo.
echo [3/3] Startar om kiosk-webblasaren pa TV:n...
ssh -i "%KEY_PATH%" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=6 %NUC_USER%@%NUC_IP% "%RESTART_CMD%; echo [OK] Kiosk har startats om!"

if errorlevel 1 (
    echo.
    color 0E
    echo ----------------------------------------------------------------------
    echo [OBS] SSH-kommandot misslyckades.
    echo ----------------------------------------------------------------------
) else (
    echo.
    color 0A
    echo ======================================================================
    echo   Klart! TV-skarmen visar nu Eventopia Dashboard i helskarm.
    echo ======================================================================
)

:end
echo.
echo Tryck valfri tangent for att avsluta...
pause >nul
