'use strict';

require('dotenv').config();

const app                 = require('../app');
const config              = require('../config');
const { sequelize }       = require('../model');

/* ══════════════════════════════════════════════════════
   SERVER BAŞLANGYÇ NOKADY
   1. Sequelize bazasyna birikýär (sync)
   2. HTTP serweri başladýar
   
   Bellik: sync({ alter: true }) diňe ösüş rejimi üçin.
   Önümçilik (production) üçin Sequelize Migrations ulanyň.
══════════════════════════════════════════════════════ */
async function dropLegacyConstraints() {
  // Köne shema: invoice_items.plu -> products.plu (harytlar indi items tablisasynda).
  // Faktura setirleri garaşsyz bolmaly — bu FK skanirlenen harytlary saklamaga päsgelçilik edýär.
  await sequelize.query('ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_plu_fkey;');
}

async function start() {
  await sequelize.authenticate();
  console.log('✓ PostgreSQL birikmesi üstünlikli');

  await dropLegacyConstraints();

  try {
    await sequelize.sync({ alter: config.env === 'development' });
    console.log(`✓ Tablisalar sinhronizasiýa edildi (${config.env})`);
  } catch (err) {
    console.warn('⚠ Tablisa sync duýduryşy (serwer dowam edýär):', err.message);
  }

  await dropLegacyConstraints();

  const itemService = require('../services/item.service');
  try {
    await itemService.clearLegacyGeneratedBarcodes();
  } catch (err) {
    console.warn('⚠ Barkod arassalama duýduryşy:', err.message);
  }

  app.listen(config.port, () => {
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
}

start().catch(err => {
  console.error('✗ Serwer başlap bilmedi:', err.message);
  process.exit(1);
});
