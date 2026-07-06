'use strict';

const { Op } = require('sequelize');
const { Item } = require('../model');
const ApiError = require('../utils/ApiError');
const { generateEan13FromKey } = require('../utils/barcode');
/* ══════════════════════════════════════════════════════
   ITEM SERVICE — Harytlar Bazasy (CRUD + CSV import)
   Barkod awtomatiki döredilmeýär — Excel import ýa-da
   el bilen girizilen bolsa saklanýar.
══════════════════════════════════════════════════════ */
function optionalStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function normalizeBarcode(v) {
  if (v == null) return null;
  const s = String(v).replace(/\s/g, '').trim();
  return s || null;
}

function normalize(data) {
  const n = {
    plu: String(data.plu || '').trim() || null,
    name: String(data.name || '').trim(),
    gram: parseInt(data.gram, 10) || 0,
    mm: parseInt(data.mm, 10) || 0,
    code: data.code != null ? String(data.code).trim() : null,
    tare: parseFloat(data.tare) || 0,
    mode: optionalStr(data.mode),
    self: optionalStr(data.self),
    label: optionalStr(data.label),
    shop: optionalStr(data.shop),
  };
  if (Object.prototype.hasOwnProperty.call(data, 'barcode')) {
    n.barcode = normalizeBarcode(data.barcode);
  }
  return n;
}

/* Kod deňeşdirme: "00340" we "340" bir haryt */
function codeLookupKeys(code) {
  const raw = String(code || '').trim();
  if (!raw) return [];
  const digits = raw.replace(/\D/g, '');
  const keys = new Set([raw]);
  if (digits) {
    keys.add(digits);
    keys.add(String(parseInt(digits, 10)));
    keys.add(digits.padStart(5, '0'));
  }
  return [...keys];
}

async function findByCodeLoose(code) {
  const keys = codeLookupKeys(code);
  if (!keys.length) return null;
  return Item.findOne({ where: { code: { [Op.in]: keys } } });
}

/* Import — diňe faýlda bar meýdanlary üýtget (boşlar öňkini pozmaýar) */
function mergeImportRow(existing, raw) {
  const n = normalize(raw);
  const out = { ...existing.toJSON() };
  const fields = ['plu', 'name', 'gram', 'mm', 'code', 'tare', 'mode', 'self', 'label', 'shop'];
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      out[key] = n[key];
    }
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'barcode')) {
    out.barcode = n.barcode;
  }
  if (!out.name) out.name = String(out.plu || out.code || 'Haryt');
  return out;
}

/* Köne awtomatiki döredilen barkodlary anyklamak (00 + kod/plu + agram) */
function isLegacyGeneratedBarcode(item) {
  const bc = normalizeBarcode(item.barcode);
  if (!bc || !/^00\d{11}$/.test(bc)) return false;

  const brutto = parseInt(item.gram, 10) || 0;
  const tare = parseFloat(item.tare) || 0;
  const net = Math.max(0, Math.round(brutto - tare));
  const keys = new Set();
  if (item.code) keys.add(String(item.code).trim());
  if (item.plu) keys.add(String(item.plu).trim());

  for (const key of keys) {
    if (!key) continue;
    if (bc === generateEan13FromKey(key, net)) return true;
    if (bc === generateEan13FromKey(key, brutto)) return true;
  }
  return false;
}

/* Serwer başlangyçda — forma arkaly döredilen köne awto-barkodlary pozýar */
async function clearLegacyGeneratedBarcodes() {
  const items = await Item.findAll({
    where: { barcode: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
  });
  let cleared = 0;
  for (const item of items) {
    if (!isLegacyGeneratedBarcode(item)) continue;
    await item.update({ barcode: null });
    cleared += 1;
  }
  if (cleared > 0) {
    console.log(`✓ Köne awto-barkodlar arassalandy: ${cleared} haryt`);
  }
  return cleared;
}

async function list(search) {
  const where = {};
  if (search) {
    const q = `%${search}%`;
    where[Op.or] = [
      { plu: { [Op.iLike]: q } },
      { code: { [Op.iLike]: q } },
      { name: { [Op.iLike]: q } },
      { barcode: { [Op.iLike]: q } },
    ];
  }
  return Item.findAll({ where, order: [['id', 'ASC']] });
}

async function getById(id) {
  const item = await Item.findByPk(id);
  if (!item) throw ApiError.notFound('Haryt tapylmady');
  return item;
}

async function create(data) {
  const n = normalize(data);
  if (!n.name) throw ApiError.badRequest('Ady hökmany');
  if (!n.code) throw ApiError.badRequest('Kod hökmany');

  const exists = await Item.findOne({ where: { code: n.code } });
  if (exists) throw ApiError.conflict(`Kod ${n.code} eýýäm bar`);

  if (!Object.prototype.hasOwnProperty.call(n, 'barcode')) n.barcode = null;
  else if (isLegacyGeneratedBarcode({ ...n, barcode: n.barcode })) n.barcode = null;
  return Item.create(n);
}

async function update(id, data) {
  const item = await getById(id);
  const n = normalize({ ...item.toJSON(), ...data });
  if (!n.name) throw ApiError.badRequest('Ady hökmany');
  if (!n.code) throw ApiError.badRequest('Kod hökmany');

  // Kod üýtgän bolsa başga harytda gaýtalanmasyn
  if (n.code !== item.code) {
    const dup = await Item.findOne({ where: { code: n.code } });
    if (dup && dup.id !== item.id) throw ApiError.conflict(`Kod ${n.code} eýýäm bar`);
  }
  await item.update(n);
  return item;
}

async function remove(id) {
  const item = await getById(id);
  await item.destroy();
  return { id: Number(id) };
}

/* CSV/Excel import — Kod boýunça upsert (00340 = 340) */
async function bulkUpsert(rows) {
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of rows) {
    const code = raw.code != null ? String(raw.code).trim() : '';
    if (!code) { skipped += 1; continue; }

    const existing = await findByCodeLoose(code);
    if (existing) {
      const merged = mergeImportRow(existing, raw);
      // Kod formatyny bazadaky sakla (00340 ýaly)
      merged.code = existing.code;
      await existing.update(merged);
      updated += 1;
    } else {
      const n = normalize(raw);
      if (!n.name) n.name = String(n.plu || n.code);
      if (!Object.prototype.hasOwnProperty.call(n, 'barcode')) n.barcode = null;
      else if (isLegacyGeneratedBarcode({ ...n, barcode: n.barcode })) n.barcode = null;
      await Item.create(n);
      added += 1;
    }
  }
  return { added, updated, skipped, total: rows.length };
}

module.exports = {
  list, getById, create, update, remove, bulkUpsert, clearLegacyGeneratedBarcodes,
};
