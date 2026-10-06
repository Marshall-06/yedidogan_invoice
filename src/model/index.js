'use strict';

const sequelize = require('../config/database');
const User = require('./user.model');
const Item = require('./item.model');
const Invoice = require('./invoice.model');
const InvoiceItem = require('./invoiceItem.model');
const ProductionOrder = require('./productionOrder.model');

/* ══════════════════════════════════════════════════════
   ASSOCIATIONS — baglanyşyklar
══════════════════════════════════════════════════════ */
Invoice.hasMany(InvoiceItem, { as: 'items', foreignKey: 'invoiceId', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { as: 'invoice', foreignKey: 'invoiceId' });

module.exports = {
  sequelize,
  User,
  Item,
  Invoice,
  InvoiceItem,
  ProductionOrder,
};
