'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/* ══════════════════════════════════════════════════════
   PRODUCTION ORDER — Önümçilik blanky (ZF)
   Başlyk sütunlary gözleg üçin; doly blank `payload` JSON.
══════════════════════════════════════════════════════ */
const ProductionOrder = sequelize.define(
  'ProductionOrder',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    zfNo: { type: DataTypes.STRING, allowNull: true },
    musteri: { type: DataTypes.STRING, allowNull: true },
    sargytsy: { type: DataTypes.STRING, allowNull: true },
    date: { type: DataTypes.DATEONLY, allowNull: true },
    productName: { type: DataTypes.STRING, allowNull: true },
    productCode: { type: DataTypes.STRING, allowNull: true },
    orderQty: { type: DataTypes.STRING, allowNull: true },
    deadline: { type: DataTypes.STRING, allowNull: true },
    jobName: { type: DataTypes.STRING, allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    tableName: 'production_orders',
    indexes: [
      { fields: ['zf_no'] },
      { fields: ['musteri'] },
      { fields: ['product_code'] },
    ],
  }
);

module.exports = ProductionOrder;
