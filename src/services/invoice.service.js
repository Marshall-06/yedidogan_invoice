'use strict';

const { sequelize, Invoice, InvoiceItem } = require('../model');
const ApiError = require('../utils/ApiError');
const {
  repairLegacySchema,
  ensureInvoiceItemsWritable,
} = require('../config/dbRepair');

function unwrapPgError(err) {
  if (!err) return null;
  const parent = err.parent || err.original;
  if (parent && parent.message && !/transaction is aborted|komutlar yok sayilacak|commands ignored/i.test(parent.message)) {
    return parent;
  }
  if (err.errors && err.errors[0]) return err.errors[0];
  return parent || err;
}

function mapInvoiceSaveError(err) {
  const root = unwrapPgError(err);
  if (err instanceof ApiError) throw err;
  if (err.name === 'SequelizeForeignKeyConstraintError' || (root && root.code === '23503')) {
    const detail = root && root.detail ? String(root.detail) : '';
    throw ApiError.badRequest('Faktura FK ýalňyşlygy. Serweri täzeden başlatyň.' + (detail ? ' ' + detail : ''));
  }
  if (root && root.code === '23502') {
    throw ApiError.badRequest('Hökmany meýdan boş: ' + (root.column || root.message));
  }
  throw ApiError.badRequest((root && root.message) || err.message || 'Faktura saklanmady');
}

function toInvoiceJson(invoice) {
  const obj = invoice.toJSON();
  if (Array.isArray(obj.items)) {
    obj.items = obj.items.map((it) => ({
      ...it,
      gross: it.gross != null ? parseFloat(it.gross) : 0,
      tare: it.tare != null ? parseFloat(it.tare) : 0,
      net: it.net != null ? parseFloat(it.net) : 0,
      boxQty: it.boxQty != null ? parseInt(it.boxQty, 10) : 1,
    }));
  }
  return obj;
}

function normalizeItem(it) {
  const tare = Math.max(0, parseFloat(it.tare) || 0);
  let net = it.net != null && it.net !== '' ? parseFloat(it.net) : NaN;
  let gross = parseFloat(it.gross) || 0;
  if (!Number.isNaN(net)) {
    gross = net + tare;
  } else {
    net = Math.max(0, gross - tare);
    gross = net + tare;
  }
  return {
    plu: null,
    name: it.name != null ? String(it.name) : null,
    code: it.code != null ? String(it.code) : null,
    width: it.width != null ? String(it.width) : null,
    mode: it.mode != null ? String(it.mode) : null,
    gross: Number(gross.toFixed(3)),
    tare: Number(tare.toFixed(3)),
    net: Number(net.toFixed(3)),
    self: it.self != null ? String(it.self) : null,
    label: it.label != null ? String(it.label) : null,
    shop: it.shop != null ? String(it.shop) : null,
    boxQty: parseInt(it.boxQty, 10) || parseInt(it.box_qty, 10) || 1,
  };
}

function buildHeader(data) {
  return {
    fakturaNo: data.fakturaNo || data.faktura_no || null,
    zawod: data.zawod || null,
    sklad: data.sklad || null,
    date: data.date || null,
    issued: data.issued || null,
    received: data.received || data.recv || null,
  };
}

async function insertItemRaw(row) {
  await sequelize.query(`
    INSERT INTO invoice_items (
      invoice_id, plu, name, code, width, mode,
      gross, tare, net, self, label, shop, box_qty,
      created_at, updated_at
    ) VALUES (
      :invoiceId, :plu, :name, :code, :width, :mode,
      :gross, :tare, :net, :self, :label, :shop, :boxQty,
      NOW(), NOW()
    )
  `, {
    replacements: {
      invoiceId: row.invoiceId,
      plu: row.plu,
      name: row.name,
      code: row.code,
      width: row.width,
      mode: row.mode,
      gross: row.gross,
      tare: row.tare,
      net: row.net,
      self: row.self,
      label: row.label,
      shop: row.shop,
      boxQty: row.boxQty,
    },
  });
}

async function prepareInvoiceDb() {
  await repairLegacySchema();
  await ensureInvoiceItemsWritable();
}

/** Transaction ýok — köne bazada "transaction aborted" bolmaz */
async function persistInvoice({ mode, id, data, items }) {
  await prepareInvoiceDb();

  let invoice;
  if (mode === 'create') {
    invoice = await Invoice.create(buildHeader(data));
  } else {
    invoice = await Invoice.findByPk(id);
    if (!invoice) throw ApiError.notFound('Faktura tapylmady');
    await invoice.update(buildHeader(data));
    await InvoiceItem.destroy({ where: { invoiceId: invoice.id } });
  }

  const rows = items.map((it) => ({ ...normalizeItem(it), invoiceId: invoice.id }));

  try {
    for (const row of rows) {
      await insertItemRaw(row);
    }
  } catch (err) {
    if (mode === 'create') {
      try { await invoice.destroy(); } catch (_) { /* ignore */ }
    }
    throw err;
  }

  const saved = await Invoice.findByPk(invoice.id, {
    include: [{ model: InvoiceItem, as: 'items' }],
  });
  return toInvoiceJson(saved);
}

async function saveInvoice(mode, id, data) {
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) throw ApiError.badRequest('Fakturada iň bolmanda bir setir bolmaly');

  try {
    return await persistInvoice({ mode, id, data, items });
  } catch (err) {
    await prepareInvoiceDb();
    try {
      return await persistInvoice({ mode, id, data, items });
    } catch (retryErr) {
      mapInvoiceSaveError(retryErr);
    }
  }
}

async function create(data) {
  return saveInvoice('create', null, data);
}

async function list({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const rows = await Invoice.findAll({
    attributes: {
      include: [
        [
          sequelize.literal(
            '(SELECT COUNT(*)::int FROM invoice_items ii WHERE ii.invoice_id = "Invoice".id)'
          ),
          'itemCount',
        ],
        [
          sequelize.literal(
            '(SELECT ii.name FROM invoice_items ii WHERE ii.invoice_id = "Invoice".id ORDER BY ii.id ASC LIMIT 1)'
          ),
          'productName',
        ],
      ],
    },
    order: [['id', 'DESC']],
    limit: safeLimit,
    offset: safeOffset,
  });

  return rows.map((inv) => {
    const obj = inv.toJSON();
    return {
      id: obj.id,
      fakturaNo: obj.fakturaNo,
      zawod: obj.zawod,
      sklad: obj.sklad,
      date: obj.date,
      issued: obj.issued,
      received: obj.received,
      itemCount: obj.itemCount != null ? Number(obj.itemCount) : 0,
      productName: obj.productName || obj.zawod || '',
      items: undefined,
    };
  });
}

async function getById(id) {
  const invoice = await Invoice.findByPk(id, {
    include: [{ model: InvoiceItem, as: 'items' }],
  });
  if (!invoice) throw ApiError.notFound('Faktura tapylmady');
  return toInvoiceJson(invoice);
}

async function remove(id) {
  const invoice = await Invoice.findByPk(id);
  if (!invoice) throw ApiError.notFound('Faktura tapylmady');
  await invoice.destroy();
  return { id: Number(id) };
}

async function update(id, data) {
  return saveInvoice('update', id, data);
}

module.exports = { create, list, getById, update, remove };
