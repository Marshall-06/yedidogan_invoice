@echo off
REM PostgreSQL bazasyny SQL bilen döret — serwerde bir gezek işlediň
cd /d "%~dp0"
title Yedidogan POS — Baza döretmek (SQL)

if not exist ".env" (
  echo [X] .env tapylmady: %~dp0.env
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [X] node.exe tapylmady. Node.js gurnalyň.
  pause
  exit /b 1
)

echo PostgreSQL bazasy SQL bilen taýýarlanýar...
echo.
node scripts\init-database.js
echo.
pause
