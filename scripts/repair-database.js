'use strict';
require('dotenv').config();
const { sequelize } = require('../src/model');
const { prepareDatabase } = require('../src/config/dbRepair');
const config = require('../src/config');

(async () => {
  await sequelize.authenticate();
  console.log('PostgreSQL OK');
  const n = await prepareDatabase(config);
  console.log(`Baza taýýar: ${n}/5 tablisa`);
  await sequelize.close();
})().catch((e) => {
  console.error('Ýalňyşlyk:', e.message);
  process.exit(1);
});
