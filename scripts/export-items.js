'use strict';

require('../src/config/loadEnv');
const fs = require('fs');
const path = require('path');
const { sequelize, Item } = require('../src/model');

const OUT = path.join(process.cwd(), 'data', 'items-sync.json');

function toExportRow(it) {
  const j = it.toJSON ? it.toJSON() : it;
  return {
    code: j.code,
    plu: j.plu,
    name: j.name,
    gram: j.gram,
    mm: j.mm,
    tare: j.tare != null ? parseFloat(j.tare) : 0,
    barcode: j.barcode,
    mode: j.mode,
    self: j.self,
    label: j.label,
    shop: j.shop,
  };
}

async function main() {
  await sequelize.authenticate();
  const rows = await Item.findAll({ order: [['id', 'ASC']] });

  const dir = path.dirname(OUT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const payload = {
    exportedAt: new Date().toISOString(),
    count: rows.length,
    items: rows.map(toExportRow),
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 0), 'utf8');
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);

  console.log('=== Harytlar eksport ===');
  console.log(`  Setir: ${rows.length}`);
  console.log(`  Faýl:  ${OUT}`);
  console.log(`  Ölçeg: ~${kb} KB`);
  console.log('');
  console.log('Windows Server-e göçürmek:');
  console.log('  1) data\\items-sync.json faýlyny server papkasyndaky data\\ içine göçür');
  console.log('  2) Serverde import-items.bat işlet');

  await sequelize.close();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('✗', e.message);
  try { await sequelize.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
