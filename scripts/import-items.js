'use strict';

require('../src/config/loadEnv');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/model');
const itemService = require('../src/services/item.service');
const { prepareDatabase } = require('../src/config/dbRepair');
const config = require('../src/config');
const { checkItemsSummary } = require('./check-items');

const IN_FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.cwd(), 'data', 'items-sync.json');

async function main() {
  if (!fs.existsSync(IN_FILE)) {
    throw new Error('Faýl tapylmady: ' + IN_FILE + '\nIlki export-items.bat işlediň.');
  }

  const raw = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
  const items = Array.isArray(raw) ? raw : (raw.items || []);
  if (!items.length) throw new Error('Faýlda haryt ýok');

  await sequelize.authenticate();
  await prepareDatabase(config);

  console.log('=== Harytlar import ===');
  console.log(`  Faýl: ${IN_FILE}`);
  console.log(`  Setir: ${items.length}`);
  console.log('');

  const result = await itemService.bulkUpsert(items);
  console.log(`✓ Täze: ${result.added}, täzelendi: ${result.updated}, geçildi: ${result.skipped}`);

  await checkItemsSummary();
  await sequelize.close();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('✗', e.message);
  try { await sequelize.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
