'use strict';

require('../src/config/loadEnv');
const { Client } = require('pg');
const config = require('../src/config');

async function checkItemsSummary(client) {
  const ownClient = !client;
  const c = client || new Client({
    host: config.db.host,
    port: config.db.port,
    database: config.db.name,
    user: config.db.user,
    password: config.db.password,
  });

  if (ownClient) await c.connect();

  const counts = await c.query(`
    SELECT
      (SELECT COUNT(*)::int FROM items) AS items,
      (SELECT COUNT(*)::int FROM invoices) AS invoices,
      (SELECT COUNT(*)::int FROM invoice_items) AS invoice_items,
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM production_orders) AS work_orders
  `);

  const row = counts.rows[0];
  console.log('');
  console.log('=== Bazada maglumat ===');
  console.log(`  Harytlar (items):     ${row.items}`);
  console.log(`  Fakturalar:           ${row.invoices}`);
  console.log(`  Faktura setirleri:    ${row.invoice_items}`);
  console.log(`  Ulanyjylar:           ${row.users}`);
  console.log(`  Work Order:           ${row.work_orders}`);

  if (row.items > 0) {
    const sample = await c.query(`
      SELECT code, plu, name FROM items
      ORDER BY id ASC LIMIT 5
    `);
    console.log('');
    console.log('Ilkinji 5 haryt:');
    sample.rows.forEach((it, i) => {
      console.log(`  ${i + 1}. Kod=${it.code || '—'}  PLU=${it.plu || '—'}  Ady=${it.name || '—'}`);
    });
  } else {
    console.log('');
    console.warn('⚠ Bazada haryt ýok — backup restore ýa-da Excel import gerek.');
  }

  const fks = await c.query(`
    SELECT conname, confrelid::regclass AS ref_table
    FROM pg_constraint
    WHERE conrelid = 'invoice_items'::regclass AND contype = 'f'
  `);
  if (fks.rows.length) {
    console.log('');
    console.log('invoice_items FK:');
    fks.rows.forEach((fk) => console.log(`  - ${fk.conname} → ${fk.ref_table}`));
    const bad = fks.rows.filter((fk) => fk.ref_table !== 'invoices');
    if (bad.length) {
      console.warn('⚠ Köne FK bar — fix-invoice-db.bat işlediň');
    }
  }

  if (ownClient) await c.end();
  return row;
}

async function main() {
  console.log('=== Harytlar barlagy ===');
  console.log(`${config.db.host}:${config.db.port}/${config.db.name}`);
  try {
    await checkItemsSummary();
    process.exit(0);
  } catch (e) {
    console.error('✗', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkItemsSummary };
