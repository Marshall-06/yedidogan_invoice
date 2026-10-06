'use strict';

const { sequelize } = require('../model');
const { applySqlSchema, countExistingTables } = require('./dbSchema');

async function rollbackQuiet() {
  try {
    await sequelize.query('ROLLBACK');
  } catch (_) { /* ignore */ }
}

async function runSql(sql, label) {
  try {
    await sequelize.query(sql);
    return true;
  } catch (err) {
    console.warn(`⚠ DB (${label}):`, err.message);
    await rollbackQuiet();
    return false;
  }
}

async function tableExists(table) {
  try {
    const [rows] = await sequelize.query(
      'SELECT to_regclass(:regclass) AS reg',
      { replacements: { regclass: `public.${table}` } }
    );
    return rows[0] && rows[0].reg != null;
  } catch (err) {
    console.warn(`⚠ DB (tableExists ${table}):`, err.message);
    await rollbackQuiet();
    return false;
  }
}

async function dropAllForeignKeys(table) {
  if (!await tableExists(table)) return;
  await runSql(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = '${table}' AND c.contype = 'f'
      ) LOOP
        EXECUTE format('ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS %I', r.conname);
      END LOOP;
    END $$;
  `, `drop ALL FK ${table}`);
}

async function ensureInvoiceInvoiceFk() {
  if (!await tableExists('invoice_items') || !await tableExists('invoices')) return;
  await runSql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'invoice_items_invoice_id_fkey'
          AND conrelid = 'invoice_items'::regclass
      ) THEN
        ALTER TABLE invoice_items
          ADD CONSTRAINT invoice_items_invoice_id_fkey
          FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `, 'invoice_items→invoices FK');
}
async function dropForeignKeysExcept(table, keepRefTable) {
  if (!await tableExists(table)) return;

  let fks;
  try {
    [fks] = await sequelize.query(`
      SELECT c.conname, r.relname AS ref_table
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_class r ON c.confrelid = r.oid
      WHERE t.relname = :table
        AND c.contype = 'f'
        AND r.relname <> :keep
    `, { replacements: { table, keep: keepRefTable } });
  } catch (err) {
    console.warn(`⚠ DB (FK list ${table}):`, err.message);
    await rollbackQuiet();
    return;
  }

  for (const row of fks) {
    const name = row.conname;
    if (!name) continue;
    await runSql(
      `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS "${name}";`,
      `drop FK ${table}.${name}→${row.ref_table}`
    );
  }
}

async function dropNotNull(table, column) {
  if (!await tableExists(table)) return;
  await runSql(
    `ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL;`,
    `${table}.${column} DROP NOT NULL`
  );
}

async function addColumnIfMissing(table, column, definition) {
  if (!await tableExists(table)) return;
  await runSql(`
    DO $$ BEGIN
      ALTER TABLE ${table} ADD COLUMN ${column} ${definition};
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;
  `, `add ${table}.${column}`);
}

/** Faktura saklamakdan öň — ähli köne FK aýyr */
async function ensureInvoiceItemsWritable() {
  if (!await tableExists('invoice_items')) return;
  await dropAllForeignKeys('invoice_items');
  await runSql(
    'ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_plu_fkey;',
    'invoice_items_plu_fkey'
  );
  await dropNotNull('invoice_items', 'plu');
  await dropNotNull('invoice_items', 'name');
  await dropNotNull('invoice_items', 'code');
  await ensureInvoiceInvoiceFk();
}

/** Köne bazadan galan çäklendirmeler we ýetmeýän sütunlar */
async function repairLegacySchema() {
  if (await tableExists('invoice_items')) {
    await dropAllForeignKeys('invoice_items');
    await runSql(
      'ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_plu_fkey;',
      'invoice_items_plu_fkey'
    );
    await dropNotNull('invoice_items', 'plu');
    await dropNotNull('invoice_items', 'name');
    await dropNotNull('invoice_items', 'code');

    await addColumnIfMissing('invoice_items', 'invoice_id', 'INTEGER');
    await addColumnIfMissing('invoice_items', 'box_qty', 'INTEGER DEFAULT 1');
    await addColumnIfMissing('invoice_items', 'gross', 'DECIMAL(10,3) DEFAULT 0');
    await addColumnIfMissing('invoice_items', 'tare', 'DECIMAL(10,3) DEFAULT 0');
    await addColumnIfMissing('invoice_items', 'net', 'DECIMAL(10,3) DEFAULT 0');
    await addColumnIfMissing('invoice_items', 'width', 'VARCHAR(255)');
    await addColumnIfMissing('invoice_items', 'mode', 'VARCHAR(255)');
    await addColumnIfMissing('invoice_items', 'self', 'VARCHAR(255)');
    await addColumnIfMissing('invoice_items', 'label', 'VARCHAR(255)');
    await addColumnIfMissing('invoice_items', 'shop', 'VARCHAR(255)');
    await addColumnIfMissing('invoice_items', 'code', 'VARCHAR(255)');
    await ensureInvoiceInvoiceFk();
  }

  if (await tableExists('items')) {
    await dropForeignKeysExcept('items', 'items');
    await dropNotNull('items', 'plu');

    await addColumnIfMissing('items', 'barcode', 'VARCHAR(255)');
    await addColumnIfMissing('items', 'tare', 'DECIMAL(10,3) DEFAULT 0');
    await addColumnIfMissing('items', 'mode', 'VARCHAR(255)');
    await addColumnIfMissing('items', 'self', 'VARCHAR(255)');
    await addColumnIfMissing('items', 'label', 'VARCHAR(255)');
    await addColumnIfMissing('items', 'shop', 'VARCHAR(255)');
    await addColumnIfMissing('items', 'code', 'VARCHAR(255)');
    await runSql(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'items' AND column_name = 'gram' AND data_type = 'integer') THEN
          ALTER TABLE items ALTER COLUMN gram TYPE DECIMAL(12,3) USING gram::numeric;
        END IF;
      END $$;
    `, 'items.gram DECIMAL');
  }
}

/** Serwer başlangyçda — baza dogry işlemeli (SQL schema, Sequelize sync ýok) */
async function prepareDatabase(config) {
  await repairLegacySchema();
  try {
    await applySqlSchema();
  } catch (err) {
    console.warn('⚠ SQL schema:', err.message);
    await rollbackQuiet();
  }
  await repairLegacySchema();
  return countExistingTables();
}

module.exports = {
  prepareDatabase,
  repairLegacySchema,
  ensureInvoiceItemSchema: repairLegacySchema,
  ensureInvoiceItemsWritable,
};
