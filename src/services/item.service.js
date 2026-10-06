'use strict';

const { Op } = require('sequelize');
const { Item } = require('../model');
const ApiError = require('../utils/ApiError');
const { generateItemBarcode, generateEan13FromKey, resolveBarcodeKey } = require('../utils/barcode');
/* ══════════════════════════════════════════════════════
   ITEM SERVICE — Harytlar Bazasy (CRUD + CSV import)
   Barkod: Kod/PLU-dan awtomatiki döreýär (Excel barkody
   bar bolsa şol saklanýar).
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

function round3(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 1000) / 1000;
}

function normalize(data) {
  const tare = round3(parseFloat(data.tare) || 0);
  let gram = parseFloat(data.gram);
  if (!Number.isFinite(gram)) gram = 0;
  gram = Math.max(0, round3(gram));

  const nettoRaw = data.netto != null ? String(data.netto).trim() : '';
  const netRaw = data.net != null ? String(data.net).trim() : '';
  const bruttoRaw = data.brutto != null ? String(data.brutto).trim() : '';

  // Import: Netto + Gilza → Brutto (gram) — tegeklemeýär, 3 onluk saklaýar
  if (nettoRaw !== '' || netRaw !== '') {
    const net = parseFloat(nettoRaw !== '' ? nettoRaw : netRaw) || 0;
    gram = Math.max(0, round3(net + tare));
  } else if (bruttoRaw !== '' && gram === 0) {
    gram = Math.max(0, round3(parseFloat(bruttoRaw) || 0));
  } else if (gram > 0 && tare > 0 && nettoRaw === '' && netRaw === '' && bruttoRaw === '') {
    // gram eýýäm brutto bolup saklanan
  }

  const n = {
    plu: String(data.plu || '').trim() || null,
    name: String(data.name || '').trim(),
    gram,
    mm: parseInt(data.mm, 10) || 0,
    code: data.code != null ? normalizeImportCode(data.code) || String(data.code).trim() : null,
    tare: Math.max(0, tare),
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

/* Excel sanlary: "340.0" / "3.4e2" → "340" (öýjük san görnüşinde bolsa) */
function normalizeImportCode(code) {
  let s = String(code == null ? '' : code).trim();
  if (!s) return '';
  if (/^\d+[.,]\d+$/.test(s)) {
    const n = Number(s.replace(',', '.'));
    if (Number.isFinite(n) && Math.floor(n) === n) s = String(n);
  } else if (/^\d+\.?\d*e[+-]?\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = String(Math.round(n));
  }
  return s.trim();
}

/* Kod deňeşdirme: "00340" we "340" bir haryt */
function codeLookupKeys(code) {
  const raw = normalizeImportCode(code);
  if (!raw) return [];
  const digits = raw.replace(/\D/g, '');
  const keys = new Set([raw]);
  if (digits) {
    keys.add(digits);
    const asInt = String(parseInt(digits, 10));
    if (Number.isFinite(parseInt(digits, 10))) keys.add(asInt);
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
  if (!out.barcode) {
    out.barcode = generateItemBarcode({ code: out.code, plu: out.plu, gram: 0 });
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

/* Serwer başlangyçda — köne awto-barkod arassalama öçürildi
   (täze algoritm Kod/PLU-dan dogry barkod döredýär) */
async function clearLegacyGeneratedBarcodes() {
  return 0;
}

async function list(search, { limit = 200, offset = 0 } = {}) {
  const where = {};
  if (search) {
    const q = String(search).trim();
    if (q) {
      // Prefiks gözleg — indeksiň peýdasy bar; `%foo%` uly bazada haýal
      const like = `${q}%`;
      const contains = `%${q}%`;
      where[Op.or] = [
        { code: { [Op.iLike]: like } },
        { barcode: { [Op.iLike]: like } },
        { plu: { [Op.iLike]: like } },
        { name: { [Op.iLike]: contains } },
        { code: { [Op.iLike]: contains } },
        { barcode: { [Op.iLike]: contains } },
        { plu: { [Op.iLike]: contains } },
      ];
    }
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const { rows, count } = await Item.findAndCountAll({
    where,
    order: [['id', 'ASC']],
    limit: safeLimit,
    offset: safeOffset,
  });

  return {
    items: rows,
    total: count,
    limit: safeLimit,
    offset: safeOffset,
  };
}

/* Skan/gozleg — bir haryt tap (barkod / kod / PLU) */
async function lookup(query) {
  const q = String(query || '').replace(/\s/g, '').trim();
  if (!q) return null;

  let item = await Item.findOne({ where: { barcode: q } });
  if (item) return item;

  item = await findByCodeLoose(q);
  if (item) return item;

  item = await Item.findOne({ where: { plu: q } });
  if (item) return item;

  // Agramly barkoddan kod bölegi (00 + 5 kod + …)
  if (/^\d{13}$/.test(q) && (q.startsWith('00') || /^2[0-9]/.test(q))) {
    const key = q.slice(2, 7);
    item = await findByCodeLoose(key);
    if (item) return item;
    item = await Item.findOne({ where: { plu: key } });
  }
  return item;
}

/* Iň uly sanly Kod + 1 — bazadaky format saklanýar ("0000421" → "0000422", "421" → "422") */
async function nextCode(fallback = 1) {
  const rows = await Item.findAll({ attributes: ['code'], raw: true });
  let maxNum = 0;
  let pad = 0;
  for (const row of rows) {
    const digits = String(row.code || '').replace(/\D/g, '');
    if (!digits) continue;
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) continue;
    if (n > maxNum || (n === maxNum && digits.length > pad)) {
      maxNum = n;
      pad = digits.length;
    }
  }
  const next = String((maxNum > 0 ? maxNum : fallback - 1) + 1);
  return pad > next.length ? next.padStart(pad, '0') : next;
}

async function getById(id) {
  const item = await Item.findByPk(id);
  if (!item) throw ApiError.notFound('Haryt tapylmady');
  return item;
}

function ensureBarcode(n) {
  if (n.barcode) return n;
  n.barcode = generateItemBarcode({
    code: n.code,
    plu: n.plu,
    gram: 0,
  });
  return n;
}

async function create(data) {
  const n = normalize(data);
  if (!n.name) throw ApiError.badRequest('Ady hökmany');
  if (!n.code) throw ApiError.badRequest('Kod hökmany');

  const exists = await Item.findOne({ where: { code: n.code } });
  if (exists) throw ApiError.conflict(`Kod ${n.code} eýýäm bar`);

  ensureBarcode(n);
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

  // Barkod boş bolsa ýa-da kod üýtgän bolsa — täzeden döret
  const codeChanged = String(n.code || '') !== String(item.code || '');
  const pluChanged = String(n.plu || '') !== String(item.plu || '');
  if (!n.barcode || codeChanged || (pluChanged && !resolveBarcodeKey(n.code, null))) {
    n.barcode = generateItemBarcode({ code: n.code, plu: n.plu, gram: 0 });
  }

  await item.update(n);
  return item;
}

async function remove(id) {
  const item = await getById(id);
  await item.destroy();
  return { id: Number(id) };
}

function rememberItemCodes(byCode, item) {
  for (const k of codeLookupKeys(item.code)) byCode.set(k, item);
}

function findInCodeMap(byCode, code) {
  for (const k of codeLookupKeys(code)) {
    if (byCode.has(k)) return byCode.get(k);
  }
  return null;
}

/* CSV/Excel import — Kod boýunça upsert.
   Faýl içindäki gaýtalanmalar we "00340"/"340" birleşdirilýär;
   unique constraint ýalňyşlygy update-e öwrülýär. */
/* Import: kod Excel-däki ýaly ýazylýar; şol kod başga harytda bar bolsa köne kod galýar */
async function updateWithFileCode(item, merged, fileCode) {
  const oldCode = item.code;
  merged.code = fileCode || oldCode;
  try {
    await item.update(merged);
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError' || merged.code === oldCode) throw err;
    merged.code = oldCode;
    await item.update(merged);
  }
}

async function bulkUpsert(rows) {
  let added = 0;
  let updated = 0;
  let skipped = 0;

  const existing = await Item.findAll();
  const byCode = new Map();
  for (const it of existing) rememberItemCodes(byCode, it);

  // Bir faýlda bir kod bir gezek: soňky setir üstünlikli
  const uniqueRows = [];
  const seenFileKeys = new Map();
  for (const raw of rows) {
    const code = normalizeImportCode(raw && raw.code);
    if (!code) { skipped += 1; continue; }
    const payload = { ...raw, code };
    let idx = -1;
    for (const k of codeLookupKeys(code)) {
      if (seenFileKeys.has(k)) { idx = seenFileKeys.get(k); break; }
    }
    if (idx >= 0) {
      uniqueRows[idx] = payload;
      for (const k of codeLookupKeys(code)) seenFileKeys.set(k, idx);
    } else {
      idx = uniqueRows.length;
      uniqueRows.push(payload);
      for (const k of codeLookupKeys(code)) seenFileKeys.set(k, idx);
    }
  }

  const toCreate = [];

  for (const raw of uniqueRows) {
    const found = findInCodeMap(byCode, raw.code);
    if (found) {
      await updateWithFileCode(found, mergeImportRow(found, raw), raw.code);
      rememberItemCodes(byCode, found);
      updated += 1;
    } else {
      const n = normalize(raw);
      n.code = normalizeImportCode(n.code) || n.code;
      if (!n.name) n.name = String(n.plu || n.code);
      ensureBarcode(n);
      toCreate.push(n);
    }
  }

  const CHUNK = 50;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const chunk = toCreate.slice(i, i + CHUNK);
    try {
      const created = await Item.bulkCreate(chunk, { returning: true });
      added += created.length;
      for (const it of created) rememberItemCodes(byCode, it);
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
      // Gaýtalanma — her setiri aýratyn upsert et
      for (const n of chunk) {
        const again = findInCodeMap(byCode, n.code) || await findByCodeLoose(n.code);
        if (again && again.id) {
          await updateWithFileCode(again, mergeImportRow(again, n), n.code);
          rememberItemCodes(byCode, again);
          updated += 1;
        } else {
          try {
            const created = await Item.create(n);
            added += 1;
            rememberItemCodes(byCode, created);
          } catch (e2) {
            if (e2.name !== 'SequelizeUniqueConstraintError') throw e2;
            const row = await findByCodeLoose(n.code);
            if (row) {
              await updateWithFileCode(row, mergeImportRow(row, n), n.code);
              rememberItemCodes(byCode, row);
              updated += 1;
            } else {
              skipped += 1;
            }
          }
        }
      }
    }
  }

  return { added, updated, skipped, total: rows.length };
}

module.exports = {
  list, getById, create, update, remove, bulkUpsert, clearLegacyGeneratedBarcodes,
  lookup, findByCodeLoose, nextCode,
};
