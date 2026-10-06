'use strict';

const asyncHandler = require('../utils/asyncHandler');
const itemService = require('../services/item.service');

/* ══════════════════════════════════════════════════════
   ITEM CONTROLLER — Harytlar Bazasy CRUD
   GET    /items?search=       → list
   GET    /items/:id           → getById
   POST   /items               → create   (admin)
   PUT    /items/:id           → update   (admin)
   DELETE /items/:id           → remove   (admin)
   POST   /items/import        → bulkUpsert CSV rows (admin)
══════════════════════════════════════════════════════ */
const list = asyncHandler(async (req, res) => {
  const limit = req.query.limit;
  const offset = req.query.offset;
  const result = await itemService.list(req.query.search, { limit, offset });
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, limit: result.limit, offset: result.offset },
  });
});

const lookup = asyncHandler(async (req, res) => {
  const q = req.query.q || req.query.code || req.query.barcode || '';
  const item = await itemService.lookup(q);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Haryt tapylmady' });
  }
  res.json({ success: true, data: item });
});

const nextCode = asyncHandler(async (req, res) => {
  const code = await itemService.nextCode();
  res.json({ success: true, data: { code } });
});

const getById = asyncHandler(async (req, res) => {
  const item = await itemService.getById(req.params.id);
  res.json({ success: true, data: item });
});

const create = asyncHandler(async (req, res) => {
  const item = await itemService.create(req.body);
  res.status(201).json({ success: true, data: item });
});

const update = asyncHandler(async (req, res) => {
  const item = await itemService.update(req.params.id, req.body);
  res.json({ success: true, data: item });
});

const remove = asyncHandler(async (req, res) => {
  const result = await itemService.remove(req.params.id);
  res.json({ success: true, data: result });
});

/* CSV/Excel satyr massiwini import etmek
   Body: { rows: [{plu, name, gram, mm, code, tare}, ...] } */
const bulkImport = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const result = await itemService.bulkUpsert(rows);
  res.json({ success: true, data: result });
});

module.exports = { list, getById, create, update, remove, bulkImport, lookup, nextCode };
