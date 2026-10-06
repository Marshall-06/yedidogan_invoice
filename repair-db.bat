@echo off
REM Baza arassala (serwer başlamazdan öň bir gezek)
cd /d "%~dp0"
title Baza arassalama

if not exist ".env" (
  echo [X] .env tapylmady
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js gerek — npm run repair-db üçin
  pause
  exit /b 1
)

echo Baza arassalanýar...
node scripts\repair-database.js
echo.
pause
