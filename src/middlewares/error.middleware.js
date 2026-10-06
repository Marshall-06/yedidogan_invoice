'use strict';

const config = require('../config');

/* ══════════════════════════════════════════════════════
   ERROR MIDDLEWARE — ähli ýalňyşlary bir görnüşde gaýtarýar
══════════════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Serwer ýalňyşlygy';
  let details = err.details;

  if (err.isOperational && err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Bu maglumat eýýäm bar (gaýtalanýan meýdan)';
    details = err.errors ? err.errors.map((e) => e.message) : undefined;
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Maglumat barlagy şowsuz';
    details = err.errors ? err.errors.map((e) => e.message) : undefined;
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Baglanyşyk ýalňyşlygy (köne FK)';
    if (err.parent && err.parent.detail) details = [err.parent.detail];
  } else if (err.name === 'SequelizeDatabaseError' && err.parent) {
    statusCode = 400;
    const pgMsg = String(err.parent.message || '');
    message = /transaction is aborted|komutlar yok sayilacak|commands ignored/i.test(pgMsg)
      ? 'Baza ýalňyşlygy — serweri täzeden başlatyň'
      : 'Baza ýalňyşlygy';
    details = err.parent.detail ? [err.parent.detail] : [pgMsg];
  }

  if (statusCode >= 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(config.env === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
