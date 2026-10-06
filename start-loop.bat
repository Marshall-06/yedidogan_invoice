@echo off
REM Yedidogan POS — serwer hemişe işläp durýar (node, exe däl)
REM Kody üýtgedeniňizde exe generate etmek gerek däl — restart ýeter
REM "start-loop.bat auto" — Windows Task üçin (pause ýok, ýalňyşlykda Task täzeden synanyşýar)
setlocal EnableExtensions
cd /d "%~dp0"
title YedidoganPOS

set "AUTO=0"
if /i "%~1"=="auto" set "AUTO=1"

if exist "%~dp0server.stop" del /f /q "%~dp0server.stop" >nul 2>&1

set "NODE=node"
where node >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE=%ProgramFiles%\nodejs\node.exe"
  ) else (
    call :fail "Node.js tapylmady — https://nodejs.org gurnalyň"
    exit /b 1
  )
)

if not exist "%~dp0src\cmd\server.js" (
  call :fail "src\cmd\server.js tapylmady"
  exit /b 1
)

if not exist "%~dp0.env" (
  call :fail ".env tapylmady — .env.example-dan göçüriň"
  exit /b 1
)

set "PORT=4000"
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%~dp0.env") do (
  if /i "%%a"=="PORT" set "PORT=%%b"
)
set "PORT=%PORT: =%"

if not exist "%~dp0node_modules" (
  echo node_modules ýok — npm install...
  call npm install --omit=dev
  if errorlevel 1 (
    call :fail "npm install şowsuz"
    exit /b 1
  )
)

REM PostgreSQL service başlamadyk bolsa başlat
powershell -NoProfile -Command "Get-Service *postgres* -EA 0 | ? {$_.Status -ne 'Running'} | Start-Service -EA 0" >nul 2>&1
call :sleep 20

:loop
if exist "%~dp0server.stop" goto :eof
call :rotate "%~dp0server-error.log"
call :rotate "%~dp0server.log"

REM Port eýýäm işleýän serwerde bolsa ikinji nusga başlamaýar — garaşýar
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -EA 0) { exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  call :sleep 30
  goto loop
)

echo START %date% %time% node >> "%~dp0server.log"
"%NODE%" "%~dp0src\cmd\server.js" >> "%~dp0server-error.log" 2>&1
echo EXIT  %date% %time% >> "%~dp0server.log"
call :sleep 5
goto loop

REM timeout gizlin/ugrukdyrylan konsolda işlemeýär — ping hemişe işleýär
:sleep
set /a "_n=%~1+1"
ping -n %_n% 127.0.0.1 >nul 2>&1
exit /b 0

REM Log 5 MB-dan uly bolsa .old.log-a geçir (disk dolmasyn)
:rotate
if not exist "%~1" exit /b 0
if %~z1 GTR 5242880 move /y "%~1" "%~dpn1.old.log" >nul 2>&1
exit /b 0

:fail
echo [X] %~1 >> "%~dp0server-error.log"
echo [X] %~1
if "%AUTO%"=="0" pause
exit /b 0
