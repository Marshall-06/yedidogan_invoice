'use strict';

/**
 * PostgreSQL bazasyny SQL bilen taýýarlaýar:
 * 1) "yedidogan" bazasyny döret (ýok bolsa)
 * 2) sql/schema.sql işledýär
 *
 * Serwerde bir gezek işlediň: init-db.bat
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('../src/config/loadEnv');
const config = require('../src/config');
const { schemaSqlPath, TABLES } = require('../src/config/dbSchema');

async function connectAdmin() {
  const { host, port, user, password } = config.db;
  const client = new Client({
    host,
    port,
    database: 'postgres',
    user,
    password,
  });
  await client.connect();
  return client;
}

async function connectAppDb() {
  const { host, port, name, user, password } = config.db;
  const client = new Client({ host, port, database: name, user, password });
  await client.connect();
  return client;
}

async function ensureDatabase(admin) {
  const { name } = config.db;
  const exists = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [name]
  );
  if (exists.rowCount > 0) {
    console.log(`✓ Baza "${name}" eýýäm bar`);
    return;
  }
  await admin.query(`CREATE DATABASE "${name}" ENCODING 'UTF8'`);
  console.log(`✓ Baza "${name}" döredildi`);
}

async function applySchema(client) {
  const sqlPath = schemaSqlPath();
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Schema tapylmady: ${sqlPath}`);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await client.query(sql);
  console.log('✓ Tablisalar SQL bilen taýýar');
}

async function printTableStatus(client) {
  for (const table of TABLES) {
    const res = await client.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    const ok = res.rows[0].reg != null;
    console.log(`  [${ok ? 'OK' : 'YOK'}] ${table}`);
  }
}

async function main() {
  const { host, port, name, user } = config.db;
  console.log('=== PostgreSQL — baza taýýarlama (SQL) ===');
  console.log(`Host: ${host}:${port}`);
  console.log(`Baza: ${name} (user: ${user})`);
  console.log('');

  let admin;
  try {
    admin = await connectAdmin();
    console.log('✓ postgres bazasyna birikdi');
  } catch (err) {
    console.error('✗ PostgreSQL birikmedi:', err.message);
    console.error('');
    console.error('Barlaň:');
    console.error('  1) Services → PostgreSQL → Start');
    console.error('  2) .env — DB_HOST, DB_PORT, DB_USER, DB_PASSWORD');
    console.error('  3) diagnostika.bat');
    process.exit(1);
  }

  try {
    await ensureDatabase(admin);
  } catch (err) {
    console.error('✗ Baza döredip bolmady:', err.message);
    console.error('');
    console.error('El bilen (pgAdmin / psql):');
    console.error(`  CREATE DATABASE ${name} ENCODING 'UTF8';`);
    console.error(`  \\c ${name}`);
    console.error(`  \\i ${schemaSqlPath()}`);
    process.exit(1);
  } finally {
    await admin.end();
  }

  let app;
  try {
    app = await connectAppDb();
    await applySchema(app);
    await printTableStatus(app);
  } catch (err) {
    console.error('✗ Schema işledip bolmady:', err.message);
    process.exit(1);
  } finally {
    if (app) await app.end();
  }

  console.log('');
  console.log('Indiki: start-console.bat ýa-da npm run start:prod');
}

main().catch((err) => {
  console.error('Ýalňyşlyk:', err.message);
  process.exit(1);
});
