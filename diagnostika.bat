@echo off
REM Serwer gurşawyny barlaýar — näme işlemeýändigini görkezýär
cd /d "%~dp0"
title Yedidogan POS — Diagnostika

echo ========================================
echo   Yedidogan POS — Diagnostika
echo ========================================
echo Papka: %~dp0
echo.

echo --- 1) Zerur faýllar ---
if exist ".env" (echo [OK] .env) else (echo [X] .env YOK)
if exist "yedidogan-zawod.exe" (echo [OK] yedidogan-zawod.exe) else (echo [!] exe YOK — node gerek)
if exist "index.html" (echo [OK] index.html) else (echo [X] index.html YOK)
if exist "start.vbs" (echo [OK] start.vbs) else (echo [!] start.vbs YOK)
echo.

echo --- 2) Node.js (exe ýok bolsa) ---
where node >nul 2>&1 && (
  node -v
) || echo [!] Node.js gurnalan däl
echo.

echo --- 3) .env maglumatlary (parol gizlin) ---
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "k=%%a"
    set "v=%%b"
    call :showenv
  )
)
echo.

echo --- 4) PostgreSQL port ---
set PGPORT=5433
if exist ".env" (
  for /f "tokens=2 delims==" %%p in ('findstr /i "^DB_PORT=" .env') do set PGPORT=%%p
)
echo .env DB_PORT = %PGPORT%
if "%PGPORT%"=="5443" echo [!] 5443 köplenç YALNYS — 5432 ýa-da 5433 barlaň!
powershell -NoProfile -Command "try { $t=New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',%PGPORT%); $t.Close(); Write-Host '[OK] Port %PGPORT% acyk' } catch { Write-Host '[X] Port %PGPORT% KAPALI — PostgreSQL ishlemeyar ýa-da port ýalňyş!' }"
echo.
echo Umumy PostgreSQL portlary synag:
powershell -NoProfile -Command "foreach ($p in 5432,5433,5443) { try { $t=New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',$p); $t.Close(); Write-Host \"  [OK] port $p acyk\" } catch { Write-Host \"  [--] port $p kapali\" } }"
echo.
echo PostgreSQL service:
sc query type= service state= all | findstr /i "postgres" 2>nul
if errorlevel 1 echo [!] postgres service tapylmady — Services-de barla
echo.

echo --- 5) POS port (4000) ---
set APPPORT=4000
if exist ".env" (
  for /f "tokens=2 delims==" %%p in ('findstr /i "^PORT=" .env') do set APPPORT=%%p
)
powershell -NoProfile -Command "try { $t=New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',%APPPORT%); $t.Close(); Write-Host '[!] Port %APPPORT% eýýäm meşgul (serwer işleýär ýa-da başga programma)' } catch { Write-Host '[OK] Port %APPPORT% boş (serwer başlap bilner)' }"
echo.

echo --- 6) Soňky loglar ---
if exist "server-error.log" (
  echo --- server-error.log (soňky 15 setir) ---
  powershell -NoProfile -Command "Get-Content 'server-error.log' -Tail 15 -ErrorAction SilentlyContinue"
  echo.
)
if exist "server.log" (
  echo --- server.log (soňky 10 setir) ---
  powershell -NoProfile -Command "Get-Content 'server.log' -Tail 10 -ErrorAction SilentlyContinue"
  echo.
)

echo ========================================
echo Indiki ädim:
echo   1) start-console.bat — ýalňyşlygy gör
echo   2) PostgreSQL Services ishleyar?
echo   3) .env DB_PASSWORD dogry?
echo ========================================
pause
exit /b 0

:showenv
if /i "%k%"=="DB_PASSWORD" echo %k%=***
if /i "%k%"=="JWT_SECRET" echo %k%=***
if /i not "%k%"=="DB_PASSWORD" if /i not "%k%"=="JWT_SECRET" if not "%k:~0,1%"=="#" if not "%k%"=="" echo %k%=%v%
exit /b 0
