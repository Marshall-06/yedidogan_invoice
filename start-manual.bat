@echo off
REM Serweri arkada başlat (node loop)
cd /d "%~dp0"
start "" /MIN cmd.exe /c "%~dp0start-loop.bat"
echo Serwer başladylýar (node)...
echo http://localhost:4000
echo http://localhost:4000/api/health
echo.
echo Duruzmak: stop-server.bat
timeout /t 3 >nul
