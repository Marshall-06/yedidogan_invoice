'use strict';

const path = require('path');
const fs = require('fs');

const { getLoadedFrom, getAppDir } = require('../config/loadEnv');

const app = require('../app');
const config = require('../config');
const { sequelize } = require('../model');
const { prepareDatabase } = require('../config/dbRepair');

/* ══════════════════════════════════════════════════════
   SERVER BAŞLANGYÇ NOKADY
   Windows Server 2022: crash-den goraýjy + graceful stop
══════════════════════════════════════════════════════ */

let httpServer = null;
let shuttingDown = false;

const bootLogPath = () => path.join(getAppDir(), 'server-error.log');

function writeBootLog(msg) {
  try {
    const line = `${new Date().toISOString()} ${msg}\n`;
    fs.appendFileSync(bootLogPath(), line, 'utf8');
  } catch (_) { /* ignore */ }
}

function logFatal(kind, err) {
  const msg = err && err.stack ? err.stack : String(err);
  console.error(`✗ ${kind}:`, msg);
  writeBootLog(`${kind}: ${msg}`);
}

process.on('uncaughtException', (err) => {
  logFatal('uncaughtException', err);
  // Işleýän soraglary bozmazlyk üçin prosesi derrew öçürmeýäris —
  // watchdog (start.vbs) zerur bolsa täzeden açar.
});

process.on('unhandledRejection', (reason) => {
  logFatal('unhandledRejection', reason);
});

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n⏹ ${signal} — serwer ýapylýar...`);
  const forceTimer = setTimeout(() => {
    console.error('✗ Ýapylmak gijikdi — mejbury çykylýar');
    process.exit(1);
  }, 15000);
  forceTimer.unref();

  try {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(() => resolve()));
    }
  } catch (err) {
    console.warn('⚠ HTTP close:', err.message);
  }
  try {
    await sequelize.close();
  } catch (err) {
    console.warn('⚠ DB close:', err.message);
  }
  clearTimeout(forceTimer);
  process.exit(0);
}

process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });
process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });
// Windows Service / taskkill meýletin ýapmak
process.on('SIGHUP', () => { gracefulShutdown('SIGHUP'); });

async function authenticateDatabase() {
  const host = config.db.host;
  const port = config.db.port;
  const maxTry = config.env === 'production' ? 12 : 1;
  const waitMs = 10000;

  for (let i = 1; i <= maxTry; i += 1) {
    try {
      await sequelize.authenticate();
      return;
    } catch (err) {
      const refused = /ECONNREFUSED|connect ENOENT|Connection refused/i.test(String(err.message || ''));
      writeBootLog(`PostgreSQL synag ${i}/${maxTry} şowsuz (${host}:${port}): ${err.message}`);
      if (!refused || i >= maxTry) throw err;
      console.warn(`⚠ PostgreSQL taýýar däl (${host}:${port}) — ${waitMs / 1000}s garaşylýar (${i}/${maxTry})...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

async function start() {
  const envSrc = getLoadedFrom() || 'ýok';
  writeBootLog(`START — .env: ${envSrc}`);
  writeBootLog(`DB ${config.db.host}:${config.db.port}/${config.db.name} user=${config.db.user}`);
  const dbInfo = `${config.db.host}:${config.db.port}/${config.db.name}`;
  console.log(`PostgreSQL: ${dbInfo} (user: ${config.db.user})`);
  console.log(`.env: ${envSrc}`);

  if (config.db.port === 5443) {
    console.warn('⚠ DB_PORT=5443 — köplenç ýalňyşlyk (5432 ýa-da 5433 bolmaly). diagnostika.bat işlediň.');
  }

  try {
    await authenticateDatabase();
    console.log('✓ PostgreSQL birikmesi üstünlikli');
  } catch (err) {
    writeBootLog(`PostgreSQL birikmesi şowsuz: ${err.message}`);
    console.error('');
    console.error('✗ PostgreSQL birikmesi şowsuz:', err.message);
    console.error(`  Synag edilen: ${dbInfo}`);
    console.error('');
    console.error('  Çözgüt:');
    console.error('  1) Services → PostgreSQL → Start (Automatic)');
    console.error('  2) .env içinde DB_PORT dogrymy? (köp ýerde 5432 ýa-da 5433)');
    console.error('  3) diagnostika.bat işlediň — haýsy port açyk görkezýär');
    throw err;
  }

  const synced = await prepareDatabase(config);
  console.log(`✓ Tablisalar taýýar (SQL, ${synced}/5)`);
  if (synced < 5) writeBootLog(`Duýduryş: diňe ${synced}/5 tablisa sync`);

  const itemService = require('../services/item.service');
  try {
    await itemService.clearLegacyGeneratedBarcodes();
  } catch (err) {
    console.warn('⚠ Barkod arassalama duýduryşy:', err.message);
  }
  httpServer = app.listen(config.port, '0.0.0.0', () => {
    console.log(`✓ Serwer işleýär → http://localhost:${config.port}`);
    console.log(`  API: http://localhost:${config.port}/api/health`);
    console.log(`  Swagger: http://localhost:${config.port}/api/docs`);
    console.log(`  Rejim: ${config.env}`);
    if (config.env === 'development') {
      console.log('\n  Ilkinji ulanyjy döretmek (öz adminiňi ýaz):');
      console.log(`  POST http://localhost:${config.port}/api/auth/register`);
      console.log('  Body: { "email": "...", "name": "...", "code": "..." }\n');
    }
  });

  httpServer.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`✗ Port ${config.port} eýýäm meşgul. Başga prosesi ýap ýa-da PORT üýtget.`);
      process.exit(1);
    }
    logFatal('httpServer.error', err);
  });

  // Windows Server: uzak boşlykdan soň TCP baglanyşyklaryny sakla
  httpServer.keepAliveTimeout = 65000;
  httpServer.headersTimeout = 66000;
}

start().catch(err => {
  const msg = err && err.stack ? err.stack : String(err);
  console.error('✗ Serwer başlap bilmedi:', err.message);
  writeBootLog(`BAŞLAP BILMEDI: ${msg}`);
  console.error('');
  console.error('Log: ' + bootLogPath());
  console.error('Diagnostika: diagnostika.bat işlediň');
  process.exit(1);
});
