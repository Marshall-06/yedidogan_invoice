@echo off
REM Awto-başlatmany öçür + serweri duruz
setlocal
cd /d "%~dp0"
set TASK_NAME=YedidoganPOS

net session >nul 2>&1
if errorlevel 1 (
  echo [!] Run as administrator
  pause
  exit /b 1
)

schtasks /End /TN "%TASK_NAME%" >nul 2>&1
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v YedidoganPOS /f >nul 2>&1
if exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\StartUp\YedidoganPOS.lnk" (
  del /f /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\StartUp\YedidoganPOS.lnk" >nul 2>&1
)

wscript.exe //B "%~dp0stop.vbs"

echo [OK] Awto-başlatma öçürildi, serwer durdy.
pause
