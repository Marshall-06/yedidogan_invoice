'use strict';
require('dotenv').config();
const { sequelize } = require('../src/model');

(async () => {
  await sequelize.authenticate();
  const [before] = await sequelize.query(
    "SELECT conname, confrelid::regclass AS ref FROM pg_constraint WHERE conrelid = 'invoice_items'::regclass AND contype = 'f'"
  );
  console.log('FK before:', before);
  await sequelize.query('ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_plu_fkey;');
  const [after] = await sequelize.query(
    "SELECT conname FROM pg_constraint WHERE conrelid = 'invoice_items'::regclass AND contype = 'f'"
  );
  console.log('FK after:', after);
  await sequelize.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
