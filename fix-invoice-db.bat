@echo off
REM Faktura bazasyny düzet — bir gezek işlet
cd /d "%~dp0"
title Faktura baza düzeltme

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js gerek — ýa-da täze exe göçüriň
  pause
  exit /b 1
)

node -e "require('./src/config/loadEnv'); const {repairLegacySchema,ensureInvoiceItemsWritable}=require('./src/config/dbRepair'); (async()=>{await repairLegacySchema(); await ensureInvoiceItemsWritable(); console.log('OK faktura baza taýýar'); process.exit(0);})().catch(e=>{console.error(e.message); process.exit(1);});"

echo.
pause
