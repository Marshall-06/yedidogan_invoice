@echo off
REM Kody üýtgedeniňden soň — serweri täzeden başlat (exe generate gerek däl)
REM Admin bilen işlediň: serwer Windows Task (SYSTEM) arkaly başlaýar
cd /d "%~dp0"
title Yedidogan POS — Restart

echo Serwer duruzylýar...
call "%~dp0stop-server.bat"

timeout /t 2 /nobreak >nul

if exist "%~dp0server.stop" del /f /q "%~dp0server.stop" >nul 2>&1

echo Serwer täzeden başladylýar (node)...
set "STARTED="
schtasks /Query /TN YedidoganPOS >nul 2>&1
if not errorlevel 1 (
  schtasks /Run /TN YedidoganPOS >nul 2>&1
  if not errorlevel 1 set "STARTED=1"
)
if not defined STARTED (
  echo [!] Windows Task tapylmady ýa-da Admin däl — serwer şu ulanyjyda başlaýar
  echo     (ulanyjy çyksa serwer durar; install-autostart.bat-y Admin bilen işlediň)
  start "" /MIN cmd.exe /c ""%~dp0start-loop.bat""
)

echo.
echo [OK] Restart edildi
echo      http://localhost:4000/api/health
timeout /t 3 >nul
