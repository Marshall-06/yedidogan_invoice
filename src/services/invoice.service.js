'use strict';

const { sequelize, Invoice, InvoiceItem } = require('../model');
const ApiError = require('../utils/ApiError');

/* ══════════════════════════════════════════════════════
   INVOICE SERVICE — faktura döretmek/okamak
   net = gross - tare (Netto = Brutto - Gilza; frontdan net gelende Brutto = net + tare)
══════════════════════════════════════════════════════ */
function toInvoiceJson(invoice) {
  const obj = invoice.toJSON();
  if (Array.isArray(obj.items)) {
    obj.items = obj.items.map((it) => ({
      ...it,
      gross: it.gross != null ? parseFloat(it.gross) : 0,
      tare: it.tare != null ? parseFloat(it.tare) : 0,
      net: it.net != null ? parseFloat(it.net) : 0,
    }));
  }
  return obj;
}

function normalizeItem(it) {
  const tare = parseFloat(it.tare) || 0;
  let net = it.net != null && it.net !== '' ? parseFloat(it.net) : NaN;
  let gross = parseFloat(it.gross) || 0;
  // Netto esasy — Brutto = Netto + Gilza
  if (!Number.isNaN(net)) {
    gross = net + tare;
  } else {
    net = Math.max(0, gross - tare);
    gross = net + tare;
  }
  return {
    // PLU invoice içinde hökmany däl; köne DB constraint-lar sebäpli "0"/"" ibermäli
    plu:
      it.plu != null && String(it.plu).trim() !== '' && String(it.plu).trim() !== '0'
        ? String(it.plu).trim()
        : null,
    name: it.name != null ? String(it.name) : null,
    code: it.code != null ? String(it.code) : null,
    width: it.width != null ? String(it.width) : null,
    mode: it.mode != null ? String(it.mode) : null,
    gross,
    tare,
    net,
    self: it.self != null ? String(it.self) : null,
    label: it.label != null ? String(it.label) : null,
    shop: it.shop != null ? String(it.shop) : null,
    boxQty: parseInt(it.boxQty, 10) || parseInt(it.box_qty, 10) || 1,
  };
}

async function create(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) throw ApiError.badRequest('Fakturada iň bolmanda bir setir bolmaly');

  return sequelize.transaction(async (t) => {
    const invoice = await Invoice.create(
      {
        fakturaNo: data.fakturaNo || data.faktura_no || null,
        zawod: data.zawod || null,
        sklad: data.sklad || null,
        date: data.date || null,
        issued: data.issued || null,
        received: data.received || data.recv || null,
      },
      { transaction: t }
    );

    const rows = items.map((it) => ({ ...normalizeItem(it), invoiceId: invoice.id }));
    await InvoiceItem.bulkCreate(rows, { transaction: t });

    const saved = await Invoice.findByPk(invoice.id, {
      include: [{ model: InvoiceItem, as: 'items' }],
      transaction: t,
    });
    return toInvoiceJson(saved);
  });
}

async function list() {
  const invoices = await Invoice.findAll({
    order: [['id', 'DESC']],
    include: [{ model: InvoiceItem, as: 'items' }],
  });
  return invoices.map(toInvoiceJson);
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
  await invoice.destroy(); // InvoiceItem CASCADE bilen pozulýar
  return { id: Number(id) };
}

async function update(id, data) {
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) throw ApiError.badRequest('Fakturada iň bolmanda bir setir bolmaly');

  return sequelize.transaction(async (t) => {
    const invoice = await Invoice.findByPk(id, { transaction: t });
    if (!invoice) throw ApiError.notFound('Faktura tapylmady');

    await invoice.update(
      {
        fakturaNo: data.fakturaNo || data.faktura_no || null,
        zawod: data.zawod || null,
        sklad: data.sklad || null,
        date: data.date || null,
        issued: data.issued || null,
        received: data.received || data.recv || null,
      },
      { transaction: t }
    );

    // Setirleri täzeden ýazýarys (ýönekeý, ygtybarly ýol).
    await InvoiceItem.destroy({ where: { invoiceId: invoice.id }, transaction: t });
    const rows = items.map((it) => ({ ...normalizeItem(it), invoiceId: invoice.id }));
    await InvoiceItem.bulkCreate(rows, { transaction: t });

    const saved = await Invoice.findByPk(invoice.id, {
      include: [{ model: InvoiceItem, as: 'items' }],
      transaction: t,
    });
    return toInvoiceJson(saved);
  });
}

module.exports = { create, list, getById, update, remove };
