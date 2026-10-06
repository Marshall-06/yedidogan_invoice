@echo off
REM Kody üýtgedeniňden soň — serweri täzeden başlat (exe generate gerek däl)
cd /d "%~dp0"
title Yedidogan POS — Restart

echo Serwer duruzylýar...
call "%~dp0stop-server.bat"

timeout /t 2 /nobreak >nul

if exist "%~dp0server.stop" del /f /q "%~dp0server.stop" >nul 2>&1

echo Serwer täzeden başladylýar (node)...
start "" /MIN cmd.exe /c "%~dp0start-loop.bat"

echo.
echo [OK] Restart edildi
echo      http://localhost:4000/api/health
timeout /t 3 >nul
