'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/* ══════════════════════════════════════════════════════
   ITEM — haryt (Harytlar Bazasy)
══════════════════════════════════════════════════════ */
const Item = sequelize.define(
  'Item',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // PLU indi hökmany däl (boş bolup biler)
    plu: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
    gram: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },     // Brutto agram (g)
    mm: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },       // Ini / Width (mm)
    // Kod (yonekey) — esasy identifikator, hökmany we unique
    code: { type: DataTypes.STRING, allowNull: false, unique: true },         // Kod
    tare: { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 0 }, // Gilza/Tara (g)
    barcode: { type: DataTypes.STRING, allowNull: true },                     // EAN-13
    mode: { type: DataTypes.STRING, allowNull: true },                        // Görnüş
    self: { type: DataTypes.STRING, allowNull: true },
    label: { type: DataTypes.STRING, allowNull: true },
    shop: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'items',
    indexes: [{ fields: ['code'] }, { fields: ['barcode'] }, { fields: ['plu'] }],
  }
);

module.exports = Item;
