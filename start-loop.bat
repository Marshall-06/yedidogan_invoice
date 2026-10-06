@echo off
REM Yedidogan POS — serwer hemişe işläp durýar (node, exe däl)
REM Kody üýtgedeniňizde exe generate etmek gerek däl — restart ýeter
cd /d "%~dp0"
title YedidoganPOS

if exist "%~dp0server.stop" del /f /q "%~dp0server.stop" >nul 2>&1

where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js tapylmady — https://nodejs.org gurnalyň >> "%~dp0server-error.log"
  echo [X] Node.js tapylmady. Node.js gurnalyň.
  pause
  exit /b 1
)

if not exist "%~dp0src\cmd\server.js" (
  echo [X] src\cmd\server.js tapylmady >> "%~dp0server-error.log"
  echo [X] src\cmd\server.js tapylmady
  pause
  exit /b 1
)

if not exist "%~dp0.env" (
  echo [X] .env tapylmady >> "%~dp0server-error.log"
  echo [X] .env tapylmady — .env.example-dan göçüriň
  pause
  exit /b 1
)

if not exist "%~dp0node_modules" (
  echo node_modules ýok — npm install...
  call npm install --omit=dev
  if errorlevel 1 (
    echo [X] npm install şowsuz >> "%~dp0server-error.log"
    pause
    exit /b 1
  )
)

REM PostgreSQL service başlamadyk bolsa başlat
powershell -NoProfile -Command "Get-Service *postgres* -EA 0 | ? {$_.Status -ne 'Running'} | Start-Service -EA 0" >nul 2>&1
timeout /t 20 /nobreak >nul

:loop
if exist "%~dp0server.stop" goto :eof
echo START %date% %time% node >> "%~dp0server.log"
node "%~dp0src\cmd\server.js" >> "%~dp0server-error.log" 2>&1
echo EXIT  %date% %time% >> "%~dp0server.log"
timeout /t 5 /nobreak >nul
goto loop
