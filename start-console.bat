@echo off
REM Görünen penjire — ýalňyşlyklary görmek (node bilen)
cd /d "%~dp0"
title Yedidogan POS — Serwer (konsol)

echo ========================================
echo   Yedidogan POS — node bilen başlatmak
echo   Ýapmak: Ctrl+C
echo ========================================
echo.

if not exist ".env" (
  echo [X] .env TAPYLMAYAR: %~dp0.env
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [X] node.exe tapylmady. Node.js gurnalyň: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules ýok — npm install...
  call npm install --omit=dev
  if errorlevel 1 (
    echo [X] npm install şowsuz
    pause
    exit /b 1
  )
)

echo [OK] .env bar
echo [OK] node:
node -v
echo.
echo Serwer: http://localhost:4000
echo API:    http://localhost:4000/api/health
echo.

node src\cmd\server.js
set EC=%ERRORLEVEL%

echo.
if %EC% NEQ 0 (
  echo [X] Serwer ýalňyşlyk bilen ýapyldy (code %EC%)
  echo     server-error.log barlaň
) else (
  echo Serwer ýapyldy.
)
echo.
pause
