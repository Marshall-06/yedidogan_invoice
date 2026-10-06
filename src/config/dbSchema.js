'use strict';

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../model');

const TABLES = ['users', 'items', 'invoices', 'invoice_items', 'production_orders'];

function schemaSqlPath() {
  return path.join(__dirname, '../../sql/schema.sql');
}

function readSchemaSql() {
  return fs.readFileSync(schemaSqlPath(), 'utf8');
}

/** Tablisalary SQL faýly bilen döret / täzele (Sequelize sync ýerine) */
async function applySqlSchema() {
  const sql = readSchemaSql();
  await sequelize.query(sql);
}

async function tableExists(table) {
  const [rows] = await sequelize.query(
    'SELECT to_regclass(:regclass) AS reg',
    { replacements: { regclass: `public.${table}` } }
  );
  return rows[0] && rows[0].reg != null;
}

async function countExistingTables() {
  let count = 0;
  for (const table of TABLES) {
    if (await tableExists(table)) count += 1;
  }
  return count;
}

module.exports = {
  TABLES,
  schemaSqlPath,
  readSchemaSql,
  applySqlSchema,
  countExistingTables,
};
