'use strict';

const { Op } = require('sequelize');
const { ProductionOrder } = require('../model');
const ApiError = require('../utils/ApiError');

/* Suratdaky defaultlar (elde üýtgedip bolýar) */
function defaultPayload() {
  return {
    tech: {
      laminasiyaGyzgynlyk: '',
      walGyzgynlygy: '',
      nokatArasy: '179',
      ichkiDiametr: '152',
      dashkyDiametr: '550',
      ini: '48',
      umumyGalynlygy: '38',
      renkSany: '5',
      fotoelement: 'REV',
      silindrOlchegi: '537*1050',
      doctorBlade: '1070',
      pecatGornush: 'ÜST',
      silindrUgry: 'Ters',
      tubSany: '155',
      uzunlykMt: 'MAX',
      // köne açarlar (öňki blanklar üçin)
      walGalyynlygy: '179',
      gilzaOlchegi: '152',
      rulonDiametri: '550',
      polatSuzguc: '48',
      goshundy: '5',
      sekilUgry: '1070',
      pecatTarapy: 'ÜST',
      sekilGornush: 'Ters',
    },
    colors: [
      { n: 1, name: '', ink: '', vernik: '', visc: '', start: '', finish: '' },
      { n: 2, name: '', ink: '', vernik: '', visc: '', start: '', finish: '' },
      { n: 3, name: '', ink: '', vernik: '', visc: '', start: '', finish: '' },
      { n: 4, name: 'YELLOW', ink: '5', vernik: '7', visc: '13', start: '', finish: '' },
      { n: 5, name: 'MAGENTA', ink: '5', vernik: '6', visc: '13', start: '', finish: '' },
      { n: 6, name: 'CYAN', ink: '5', vernik: '7', visc: '13', start: '', finish: '' },
      { n: 7, name: 'EXTRA', ink: '2347/485', vernik: '', visc: '13-14', start: '', finish: '' },
      { n: 8, name: 'BLACK', ink: '5', vernik: '3', visc: '13', start: '', finish: '' },
    ],
    afterColor: {
      guratma: ['', '', '', '55', '56', '57', '61', '59'],
      guratmaHi: ['', '', '', '64', '65', '66', '70', '68'],
      speedMain: '160',
      speedAlt: '100',
      startTPsi: '32.31',
      finishTPsi: '29.23',
      times: {
        pecat: { bashlan: '', tayyarlyk: '', dynan: '' },
        laminasiya: { bashlan: '', tayyarlyk: '', dynan: '' },
        kesim: { bashlan: '', tayyarlyk: '', dynan: '' },
        upakowka: { bashlan: '', tayyarlyk: '', dynan: '' },
      },
      bashlanWagty: '',
      tayyarlykWagty: '',
      dynanWagty: '',
      material1: 'BOPPper WAL_China',
      materialRatio: '38/1000',
      material2: '',
      material3: '',
      pressRolik: '1000',
      laminPress: '80000',
      kraskaKg: '',
      rastworitelKg: '',
      kleyKg: '',
      coldSealKg: '',
      clisheSany: '',
      orient: '',
      pack: { adaty: false, korobka: false, strec: false, paddon: false },
    },
    pecat: Array.from({ length: 20 }, () => ''),
    laminasiya: Array.from({ length: 10 }, () => ''),
    kesim: Array.from({ length: 10 }, () => ''),
    upakowka: false,
  };
}

function pickHeader(data) {
  return {
    zfNo: data.zfNo != null ? String(data.zfNo).trim() : null,
    musteri: data.musteri != null ? String(data.musteri).trim() : null,
    sargytsy: data.sargytsy != null ? String(data.sargytsy).trim() : null,
    date: data.date || null,
    productName: data.productName != null ? String(data.productName).trim() : null,
    productCode: data.productCode != null ? String(data.productCode).trim() : null,
    orderQty: data.orderQty != null ? String(data.orderQty).trim() : null,
    deadline: data.deadline != null ? String(data.deadline).trim() : null,
    jobName: data.jobName != null ? String(data.jobName).trim() : null,
  };
}

function toJson(row) {
  const o = row.toJSON ? row.toJSON() : row;
  return {
    id: o.id,
    ...pickHeader(o),
    payload: o.payload || {},
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function list({ limit = 50, offset = 0, search = '' } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
  const where = {};
  const q = String(search || '').trim();
  if (q) {
    where[Op.or] = [
      { zfNo: { [Op.iLike]: `%${q}%` } },
      { musteri: { [Op.iLike]: `%${q}%` } },
      { productName: { [Op.iLike]: `%${q}%` } },
      { productCode: { [Op.iLike]: `%${q}%` } },
      { jobName: { [Op.iLike]: `%${q}%` } },
    ];
  }
  const { rows, count } = await ProductionOrder.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    limit: safeLimit,
    offset: safeOffset,
  });
  return {
    items: rows.map(toJson),
    total: count,
    limit: safeLimit,
    offset: safeOffset,
  };
}

async function getById(id) {
  const row = await ProductionOrder.findByPk(id);
  if (!row) throw ApiError.notFound('Önümçilik blanky tapylmady');
  return toJson(row);
}

async function create(data) {
  const header = pickHeader(data);
  const base = defaultPayload();
  const payload = { ...base, ...(data.payload || {}) };
  if (data.payload && data.payload.afterColor) {
    payload.afterColor = { ...base.afterColor, ...data.payload.afterColor };
  }
  if (data.payload && data.payload.tech) {
    payload.tech = { ...base.tech, ...data.payload.tech };
  }
  const row = await ProductionOrder.create({ ...header, payload });
  return toJson(row);
}

async function update(id, data) {
  const row = await ProductionOrder.findByPk(id);
  if (!row) throw ApiError.notFound('Önümçilik blanky tapylmady');
  const header = pickHeader({ ...row.toJSON(), ...data });
  const prev = row.payload || defaultPayload();
  const next = { ...prev, ...(data.payload || {}) };
  if (data.payload && data.payload.afterColor) {
    next.afterColor = { ...(prev.afterColor || {}), ...data.payload.afterColor };
  }
  if (data.payload && data.payload.tech) {
    next.tech = { ...(prev.tech || {}), ...data.payload.tech };
  }
  await row.update({ ...header, payload: next });
  return toJson(row);
}

async function remove(id) {
  const row = await ProductionOrder.findByPk(id);
  if (!row) throw ApiError.notFound('Önümçilik blanky tapylmady');
  await row.destroy();
  return { id: Number(id) };
}

async function distinctMusteriler() {
  const rows = await ProductionOrder.findAll({
    attributes: ['musteri'],
    where: { musteri: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
    raw: true,
  });
  const set = new Set();
  for (const r of rows) {
    const v = String(r.musteri || '').trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'tk'));
}

async function nextZfNo() {
  const rows = await ProductionOrder.findAll({ attributes: ['zfNo'], raw: true });
  let max = 0;
  for (const r of rows) {
    const d = String(r.zfNo || '').replace(/\D/g, '');
    if (!d) continue;
    const n = parseInt(d, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

module.exports = {
  defaultPayload,
  list,
  getById,
  create,
  update,
  remove,
  distinctMusteriler,
  nextZfNo,
};
