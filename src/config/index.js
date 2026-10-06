'use strict';

require('./loadEnv');

/* ══════════════════════════════════════════════════════
   CONFIG — daşky gurşaw (env) sazlamalary bir ýerde
══════════════════════════════════════════════════════ */
function intEnv(key, fallback) {
  const raw = process.env[key];
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: intEnv('PORT', 4000),
  corsOrigin: process.env.CORS_ORIGIN || '*',

  db: {
    host: (process.env.DB_HOST || 'localhost').trim(),
    port: intEnv('DB_PORT', 5433),
    name: (process.env.DB_NAME || 'yedidogan').trim(),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    logging: String(process.env.DB_LOGGING).toLowerCase() === 'true',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};

module.exports = config;
