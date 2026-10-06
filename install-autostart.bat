@echo off
REM Bir gezek Admin bilen işlet — Windows açylanda POS (node) awto başlaýar
REM Windows Task (SYSTEM): ulanyjy girmese / çyksa hem serwer işläp durýar
setlocal EnableExtensions
cd /d "%~dp0"

set "TASK=YedidoganPOS"
set "BAT=%~dp0start-loop.bat"
set "APPDIR=%~dp0"

if not exist "%BAT%" (
  echo start-loop.bat tapylmady
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  if not exist "%ProgramFiles%\nodejs\node.exe" (
    echo [X] Node.js tapylmady. Ilki Node.js gurnalyň: https://nodejs.org
    pause
    exit /b 1
  )
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
  echo [!] Admin hukugy gerek: sag bas - Run as administrator
  pause
  exit /b 1
)

if not exist "%~dp0node_modules" (
  echo node_modules ýok — npm install...
  call npm install --omit=dev
)

REM PostgreSQL hem Windows bilen awto başlasyn
powershell -NoProfile -Command "Get-Service *postgres* -EA 0 | Set-Service -StartupType Automatic -EA 0; Get-Service *postgres* -EA 0 | ? {$_.Status -ne 'Running'} | Start-Service -EA 0" >nul 2>&1

REM Köne awto-başlatmalar (birnäçe nusga açylmasyn)
schtasks /Delete /TN "%TASK%" /F >nul 2>&1
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v YedidoganPOS /f >nul 2>&1
del /f /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\StartUp\YedidoganPOS.lnk" >nul 2>&1

REM Kompýuter açylanda (boot), wagt çägi ýok, ýykylsa her minut täzeden
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $a=New-ScheduledTaskAction -Execute ([char]34+$env:BAT+[char]34) -Argument 'auto' -WorkingDirectory $env:APPDIR; $t=New-ScheduledTaskTrigger -AtStartup; $t.Delay='PT1M'; $s=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew; $p=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest; Register-ScheduledTask -TaskName $env:TASK -Action $a -Trigger $t -Settings $s -Principal $p -Force | Out-Null"
if errorlevel 1 (
  echo Task döredilmedi!
  pause
  exit /b 1
)

echo Serwer başladylýar (node, SYSTEM)...
schtasks /Run /TN "%TASK%" >nul

echo.
echo [OK] Awto-baslatma gurnaldy — node bilen (exe gerek däl)
echo      Windows açylanda 1 minutdan soň serwer özi başlaýar
echo      Kody üýtget → restart-server.bat (Admin)
echo      Barlag: http://localhost:4000/api/health
schtasks /Query /TN "%TASK%" /FO LIST | findstr /I "TaskName Status"
echo.
pause
