'use strict';

const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/productionOrder.service');

const list = asyncHandler(async (req, res) => {
  const result = await service.list({
    limit: req.query.limit,
    offset: req.query.offset,
    search: req.query.search,
  });
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, limit: result.limit, offset: result.offset },
  });
});

const getById = asyncHandler(async (req, res) => {
  const row = await service.getById(req.params.id);
  res.json({ success: true, data: row });
});

const create = asyncHandler(async (req, res) => {
  const row = await service.create(req.body);
  res.status(201).json({ success: true, data: row });
});

const update = asyncHandler(async (req, res) => {
  const row = await service.update(req.params.id, req.body);
  res.json({ success: true, data: row });
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.remove(req.params.id);
  res.json({ success: true, data: result });
});

const meta = asyncHandler(async (req, res) => {
  const [musteriler, nextZf] = await Promise.all([
    service.distinctMusteriler(),
    service.nextZfNo(),
  ]);
  res.json({
    success: true,
    data: {
      musteriler,
      nextZfNo: nextZf,
      defaults: service.defaultPayload(),
    },
  });
});

module.exports = { list, getById, create, update, remove, meta };
