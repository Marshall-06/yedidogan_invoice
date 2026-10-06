'use strict';

const path = require('path');
const { Client } = require('pg');
const { getLoadedFrom } = require('../src/config/loadEnv');
const config = require('../src/config');

async function main() {
  const envSrc = getLoadedFrom() || 'ýok';
  const { host, port, name, user, password } = config.db;

  console.log('=== PostgreSQL synag ===');
  console.log('.env:', envSrc);
  console.log(`Baglanyşyk: ${host}:${port}/${name} (user: ${user})`);

  if (port === 5443) {
    console.warn('');
    console.warn('⚠ DB_PORT=5443 — köplenç ýalňyşlyk! 5432 ýa-da 5433 barlaň.');
    console.warn('');
  }

  const client = new Client({ host, port, database: name, user, password });

  try {
    await client.connect();
    const res = await client.query('SELECT version() AS v, current_database() AS db');
    console.log('✓ Üstünlikli birikdi');
    console.log('  Baza:', res.rows[0].db);
    console.log('  PG:', String(res.rows[0].v).slice(0, 80));
    process.exit(0);
  } catch (err) {
    console.error('✗ Birikmedi:', err.message);
    if (/ECONNREFUSED/i.test(err.message)) {
      console.error('');
      console.error('Port kapalı — PostgreSQL işlemeýär ýa-da DB_PORT ýalňyş.');
      console.error('diagnostika.bat işlediň — haýsy port açyk görkezýär.');
    }
    process.exit(1);
  } finally {
    try { await client.end(); } catch (_) { /* ignore */ }
  }
}

main();
