'use strict';

const { Sequelize } = require('sequelize');
const config = require('./index');

/* ══════════════════════════════════════════════════════
   DATABASE — Sequelize/PostgreSQL birikmesi
══════════════════════════════════════════════════════ */
const isProd = config.env === 'production';

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'postgres',
  logging: config.db.logging ? console.log : false,
  define: {
    underscored: true,   // sütün atlary snake_case
    timestamps: true,
  },
  // Windows Server / uzak PostgreSQL: baglanyşyk pool + keepalive
  pool: {
    max: isProd ? 20 : 10,
    min: isProd ? 2 : 0,
    acquire: 60000,
    idle: 30000,
    evict: 10000,
  },
  dialectOptions: {
    keepAlive: true,
  },
  retry: {
    max: 3,
  },
});

module.exports = sequelize;
