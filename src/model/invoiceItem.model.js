'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/* ══════════════════════════════════════════════════════
   INVOICE ITEM — fakturanyň setiri
   net = gross - tare (servisde hasaplanýar)
══════════════════════════════════════════════════════ */
const InvoiceItem = sequelize.define(
  'InvoiceItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    invoiceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'invoices', key: 'id' },
      onDelete: 'CASCADE',
    },
    plu: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    code: { type: DataTypes.STRING, allowNull: true },
    width: { type: DataTypes.STRING, allowNull: true },
    mode: { type: DataTypes.STRING, allowNull: true },
    gross: { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 0 },
    tare: { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 0 },
    net: { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 0 },
    self: { type: DataTypes.STRING, allowNull: true },
    label: { type: DataTypes.STRING, allowNull: true },
    shop: { type: DataTypes.STRING, allowNull: true },
    boxQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  },
  { tableName: 'invoice_items', indexes: [{ fields: ['invoice_id'] }] }
);

module.exports = InvoiceItem;
