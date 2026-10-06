'use strict';

const asyncHandler = require('../utils/asyncHandler');
const invoiceService = require('../services/invoice.service');

/* ══════════════════════════════════════════════════════
   INVOICE CONTROLLER — Faktura
   GET    /invoices            → list    (admin)
   GET    /invoices/:id        → getById (admin)
   POST   /invoices            → create  (admin)
   PUT    /invoices/:id        → update  (admin)
   PATCH  /invoices/:id        → update  (admin)
   DELETE /invoices/:id        → remove  (admin)
══════════════════════════════════════════════════════ */
const list = asyncHandler(async (req, res) => {
  const invoices = await invoiceService.list({
    limit: req.query.limit,
    offset: req.query.offset,
  });
  res.json({ success: true, data: invoices });
});

const getById = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getById(req.params.id);
  res.json({ success: true, data: invoice });
});

const create = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.create(req.body);
  res.status(201).json({ success: true, data: invoice });
});

const update = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.update(req.params.id, req.body);
  res.json({ success: true, data: invoice });
});

const remove = asyncHandler(async (req, res) => {
  const result = await invoiceService.remove(req.params.id);
  res.json({ success: true, data: result });
});

module.exports = { list, getById, create, update, remove };
