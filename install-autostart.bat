@echo off
REM Bir gezek Admin bilen işlet — Windows açylanda POS (node) awto başlaýar
setlocal EnableExtensions
cd /d "%~dp0"

set TASK=YedidoganPOS
set BAT=%~dp0start-loop.bat

if not exist "%BAT%" (
  echo start-loop.bat tapylmady
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js tapylmady. Ilki Node.js gurnalyň: https://nodejs.org
  pause
  exit /b 1
)

if not exist "%~dp0src\cmd\server.js" (
  echo [X] src\cmd\server.js tapylmady
  pause
  exit /b 1
)

if not exist "%~dp0.env" (
  echo [X] .env tapylmady — .env.example-dan göçüriň we dolduryň
  pause
  exit /b 1
)

net session >nul 2>&1
if errorlevel 1 (
  echo [!] Run as administrator (sag bas → Run as administrator)
  pause
  exit /b 1
)

if not exist "%~dp0node_modules" (
  echo node_modules ýok — npm install...
  call npm install --omit=dev
)

schtasks /Delete /TN "%TASK%" /F >nul 2>&1
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v YedidoganPOS /f >nul 2>&1

REM Kompýuter açylanda (boot)
schtasks /Create /TN "%TASK%" /TR "\"%BAT%\"" /SC ONSTART /DELAY 0001:30 /RU SYSTEM /RL HIGHEST /F
if errorlevel 1 (
  echo Task döredilmedi!
  pause
  exit /b 1
)

REM Ulanyjy girende hem
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v YedidoganPOS /t REG_SZ /d "\"%BAT%\"" /f >nul

REM Startup shortcut
powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut('$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\YedidoganPOS.lnk'); $s.TargetPath='%BAT%'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()" >nul 2>&1

echo Serwer başladylýar (node)...
start "" /MIN "%BAT%"

echo.
echo [OK] Awto-baslatma gurnaldy — node bilen (exe gerek däl)
echo      Kody üýtget → diňe serweri restart et (stop soň start)
echo      Barlag: http://localhost:4000/api/health
schtasks /Query /TN "%TASK%" /FO LIST | findstr /I "TaskName Status"
echo.
pause
