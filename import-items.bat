@echo off
REM data\items-sync.json → Windows Server bazasyna (upsert)
cd /d "%~dp0"
title Harytlar import

if not exist ".env" (echo [X] .env tapylmady & pause & exit /b 1)
where node >nul 2>&1 || (echo [X] Node.js gerek & pause & exit /b 1)

if not exist "data\items-sync.json" (
  echo [X] data\items-sync.json tapylmady
  echo     Öz kompýuterinde export-items.bat işlediň, soň bu faýly göçüriň
  pause
  exit /b 1
)

node scripts\import-items.js
echo.
pause
