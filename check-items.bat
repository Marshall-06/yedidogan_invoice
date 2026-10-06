@echo off
REM Bazada näçe haryt bar — barla
cd /d "%~dp0"
title Yedidogan — Harytlar barlagy

if not exist ".env" (
  echo [X] .env tapylmady
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js gerek
  pause
  exit /b 1
)

node scripts\check-items.js
echo.
pause
