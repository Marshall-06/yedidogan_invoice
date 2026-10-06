'use strict';

const { Router } = require('express');
const authRouter    = require('./auth.router');
const userRouter    = require('./user.router');
const itemRouter    = require('./item.router');
const invoiceRouter = require('./invoice.router');
const productionOrderRouter = require('./productionOrder.router');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');
const { repairLegacySchema } = require('../config/dbRepair');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

/* ══════════════════════════════════════════════════════
   API marşrutlarynyň merkezi ýygyndysy
   /api/auth      → registrasiýa / giriş / me
   /api/users     → ulanyjy dolandyryş (admin)
   /api/items     → harytlar bazasy
   /api/invoices  → fakturalar (admin)
══════════════════════════════════════════════════════ */
router.use('/auth',     authRouter);
router.use('/users',    userRouter);
router.use('/items',    itemRouter);
router.use('/invoices', invoiceRouter);
router.use('/production-orders', productionOrderRouter);

/* Köne baza arassalama (faktura saklanmazlygy üçin) */
router.post('/repair-db', authenticate, requireAdmin, asyncHandler(async (_req, res) => {
  await repairLegacySchema();
  res.json({ success: true, message: 'Baza arassalandy ✓' });
}));

/* API saglygy barlag */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Label Zawod API işleýär ✓',
    env: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
  });
});

module.exports = router;
