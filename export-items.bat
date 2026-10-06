@echo off
REM Kiçi faýl — ähli harytlar (ady, kod, barkod…) → data\items-sync.json
cd /d "%~dp0"
title Harytlar eksport

if not exist ".env" (echo [X] .env tapylmady & pause & exit /b 1)
where node >nul 2>&1 || (echo [X] Node.js gerek & pause & exit /b 1)

node scripts\export-items.js
echo.
pause
