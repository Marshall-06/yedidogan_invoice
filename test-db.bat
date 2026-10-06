@echo off
REM PostgreSQL birikmesini synag — .env maglumatlary bilen
cd /d "%~dp0"
title Yedidogan POS — PostgreSQL synag

if not exist ".env" (
  echo [X] .env tapylmady: %~dp0.env
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [X] node.exe tapylmady. Node.js gurnalyň ýa-da diagnostika.bat işlediň.
  pause
  exit /b 1
)

node scripts\test-db.js
echo.
pause
