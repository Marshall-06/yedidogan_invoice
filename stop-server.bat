@echo off
REM Serweri duruz (node / watchdog)
cd /d "%~dp0"
title Yedidogan POS — Duruz

echo server.stop ýazylýar...
echo stop %date% %time%> "%~dp0server.stop"

schtasks /End /TN YedidoganPOS >nul 2>&1
wscript.exe //B "%~dp0stop.vbs"

REM Node prosesini dogrudan ýap (server.js)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'src\\\\cmd\\\\server\.js|server\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -EA 0 }" >nul 2>&1

taskkill /F /IM yedidogan-zawod.exe /T >nul 2>&1
taskkill /F /IM yedidogan-zawod-new.exe /T >nul 2>&1

echo [OK] Serwer durdy.
timeout /t 2 >nul
