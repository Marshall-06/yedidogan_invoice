'use strict';

/* ══════════════════════════════════════════════════════
   STORAGE — maglumat gatlagy (backend API esasly)
   Harytlar serwerden çekilýär we ITEM_DB-de keş hökmünde
   saklanýar. Üýtgemeler API arkaly serwere ýazylýar.
══════════════════════════════════════════════════════ */

let ITEM_DB = [];
let ITEM_META = { total: 0, limit: 200, offset: 0 };
let ITEM_BY_ID = new Map();
let ITEM_BY_BARCODE = new Map();
let ITEM_BY_CODE = new Map();
let ITEM_BY_PLU = new Map();

function debounce(fn, ms) {
  let t = null;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function normalizeDigits(s){ return String(s || '').replace(/\D/g, ''); }
function comparableKey(s){
  const d = normalizeDigits(s);
  if(!d) return null;
  return String(parseInt(d, 10));
}

/* Kod gözleg açarlary — serwer item.service.js bilen birmeňzeş */
function codeLookupKeys(code) {
  const raw = String(code || '').trim();
  if (!raw) return [];
  const digits = raw.replace(/\D/g, '');
  const keys = new Set([raw]);
  if (digits) {
    keys.add(digits);
    const n = parseInt(digits, 10);
    if (Number.isFinite(n)) keys.add(String(n));
    keys.add(digits.padStart(5, '0'));
  }
  const ck = comparableKey(raw);
  if (ck) keys.add(ck);
  return [...keys];
}

function rebuildItemMaps() {
  ITEM_BY_ID = new Map();
  ITEM_BY_BARCODE = new Map();
  ITEM_BY_CODE = new Map();
  ITEM_BY_PLU = new Map();
  for (const it of ITEM_DB) {
    if (!it) continue;
    ITEM_BY_ID.set(String(it.id), it);
    const bc = (it.barcode || '').replace(/\s/g, '');
    if (bc) ITEM_BY_BARCODE.set(bc, it);
    const ck = comparableKey(it.code);
    if (ck) ITEM_BY_CODE.set(ck, it);
    for (const k of codeLookupKeys(it.code)) {
      if (!ITEM_BY_CODE.has(k)) ITEM_BY_CODE.set(k, it);
    }
    if (it.plu != null && String(it.plu).trim() !== '') {
      ITEM_BY_PLU.set(String(it.plu).trim(), it);
    }
  }
}

/* Serwerden harytlary täzeden çekýär (limit bilen — uly bazada ýokary ornu) */
async function refreshItems(search, { limit = 200, offset = 0 } = {}) {
  const res = await API.items.list(search || '', { limit, offset });
  const items = Array.isArray(res) ? res : (res && res.data) || [];
  ITEM_DB = items;
  ITEM_META = (res && res.meta) || { total: items.length, limit, offset };
  rebuildItemMaps();
  return ITEM_DB;
}

/* Ähli harytlary sahypa-sahypa çek (export / doly sanaw üçin) */
async function refreshAllItems(search = '') {
  const pageSize = 500;
  let offset = 0;
  let total = Infinity;
  let all = [];
  while (offset < total) {
    const res = await API.items.list(search || '', { limit: pageSize, offset });
    const chunk = Array.isArray(res) ? res : (res && res.data) || [];
    const meta = (!Array.isArray(res) && res && res.meta) ? res.meta : null;
    total = meta && meta.total != null ? meta.total : (offset + chunk.length);
    all = all.concat(chunk);
    offset += chunk.length;
    if (!chunk.length) break;
  }
  ITEM_DB = all;
  ITEM_META = { total: all.length, limit: all.length, offset: 0 };
  rebuildItemMaps();
  return ITEM_DB;
}

function findItem(id){ return ITEM_BY_ID.get(String(id)) || null; }
function findItemByPlu(plu){
  const key = String(plu || '').trim();
  if (!key) return null;
  return ITEM_BY_PLU.get(key) || null;
}

function findItemByCodeLoose(code) {
  for (const k of codeLookupKeys(code)) {
    const it = ITEM_BY_CODE.get(k);
    if (it) return it;
  }
  return null;
}

function findItemByCode(code){
  return findItemByCodeLoose(code);
}
function findItemByBarcode(code){
  const c = (code||'').replace(/\s/g,'');
  if(!c) return null;
  return ITEM_BY_BARCODE.get(c) || null;
}

/* Skan — ilki ýerli Map, tapylmasa serwer /lookup (serwer lookup bilen birmeňzeş) */
async function lookupItemAsync(query) {
  const q = String(query || '').replace(/\s/g, '').trim();
  if (!q) return null;

  let it = findItemByBarcode(q);
  if (it) return it;

  it = findItemByCodeLoose(q);
  if (it) return it;

  it = findItemByPlu(q);
  if (it) return it;

  // Agramly barkod: 00 | 5 san kod | 5 san agram | kontrol
  if (/^\d{13}$/.test(q) && (q.startsWith('00') || /^2[0-9]/.test(q))) {
    const key = q.slice(2, 7);
    it = findItemByCodeLoose(key);
    if (it) return it;
    it = findItemByPlu(key);
    if (it) return it;
  }

  const parsed = parseBC(q);
  if (parsed && parsed.code) {
    it = findItemByCodeLoose(parsed.code);
    if (it) return it;
    if (parsed.plu) {
      it = findItemByPlu(parsed.plu);
      if (it) return it;
    }
  }

  try {
    it = await API.items.lookup(q);
    if (it) {
      if (!ITEM_BY_ID.has(String(it.id))) {
        ITEM_DB.push(it);
        rebuildItemMaps();
      }
    }
    return it;
  } catch (e) {
    return null;
  }
}

/* ══════════════════════════════════════════════════════
   BARKOD UTILITALARY (EAN-13) — src/utils/barcode.js bilen birmeňzeş
   Gurluş: 00 | açar (5 san) | agram (5 san) | kontrol sany
   Mysal:  kod 339 → 00 00339 00000 C
══════════════════════════════════════════════════════ */
const TM_GS1_PREFIX = '483';
const WEIGHT_BC_PREFIX = '00';

function digitsOnly(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

function ean13Checksum(digits12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function isValidBarcodeFormat(code) {
  code = String(code || '').replace(/\s/g, '');
  if (!/^\d{13}$/.test(code)) return false;
  return ean13Checksum(code.slice(0, 12)) === parseInt(code[12], 10);
}

function resolveBarcodeKey(code, plu) {
  const fromCode = digitsOnly(code);
  const fromPlu = digitsOnly(plu);
  const raw = fromCode || fromPlu;
  if (!raw) return null;
  return raw.padStart(5, '0').slice(-5);
}

function generateEan13FromKey(key, gram) {
  const keyDigits = digitsOnly(key).padStart(5, '0').slice(-5);
  const gramDigits = String(Math.round(parseFloat(gram) || 0))
    .replace(/\D/g, '')
    .padStart(5, '0')
    .slice(-5);
  const base12 = (WEIGHT_BC_PREFIX + keyDigits + gramDigits).slice(0, 12);
  return base12 + ean13Checksum(base12);
}

function generateEan13FromPlu(plu, gram) {
  return generateEan13FromKey(plu, gram);
}

function generateItemBarcode(codeOrOpts, plu, gram) {
  let code, g;
  if (codeOrOpts && typeof codeOrOpts === 'object') {
    code = codeOrOpts.code;
    plu = codeOrOpts.plu;
    g = codeOrOpts.gram;
  } else {
    code = codeOrOpts;
    g = gram;
  }
  const key = resolveBarcodeKey(code, plu);
  if (!key) return null;
  return generateEan13FromKey(key, g || 0);
}

const EAN_L = ['0001101','0011001','0010011','0111101','0100011',
               '0110001','0101111','0111011','0110111','0001011'];
const EAN_G = ['0100111','0110011','0011011','0100001','0011101',
               '0111001','0000101','0010001','0001001','0010111'];
const EAN_R = ['1110010','1100110','1101100','1000010','1011100',
               '1001110','1010000','1000100','1001000','1110100'];
const EAN_PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG',
                    'LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

function ean13Svg(code){
  code = String(code||'').replace(/\D/g,'');
  if(code.length === 12) code += ean13Checksum(code);
  if(code.length !== 13) return '';

  const first = parseInt(code[0]);
  const left  = code.slice(1,7);
  const right = code.slice(7,13);
  const parity = EAN_PARITY[first];

  let bits = '101';
  for(let i=0;i<6;i++){
    const d = parseInt(left[i]);
    bits += (parity[i] === 'L' ? EAN_L : EAN_G)[d];
  }
  bits += '01010';
  for(let i=0;i<6;i++){
    bits += EAN_R[parseInt(right[i])];
  }
  bits += '101';

  const mw = 2, qzL = 11, qzR = 7;
  const barH = 64, guardExtra = 7, textY = barH + 18, height = barH + 22;
  const totalMods = qzL + bits.length + qzR;
  const width = totalMods * mw;
  const isGuard = idx => (idx<3) || (idx>=45 && idx<50) || (idx>=92);

  let rects = '';
  for(let i=0;i<bits.length;i++){
    if(bits[i] !== '1') continue;
    const x = (qzL + i) * mw;
    const h = isGuard(i) ? barH + guardExtra : barH;
    rects += `<rect x="${x}" y="0" width="${mw}" height="${h}"/>`;
  }

  const tStyle = `font-family:monospace;font-size:11px;fill:#000`;
  let texts = `<text x="${(qzL-7)*mw}" y="${textY}" style="${tStyle}">${first}</text>`;
  for(let j=0;j<6;j++){
    const cx = (qzL + 3 + j*7 + 3.5) * mw;
    texts += `<text x="${cx}" y="${textY}" text-anchor="middle" style="${tStyle}">${left[j]}</text>`;
  }
  for(let j=0;j<6;j++){
    const cx = (qzL + 3 + 45 + j*7 + 3.5) * mw;
    texts += `<text x="${cx}" y="${textY}" text-anchor="middle" style="${tStyle}">${right[j]}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rects}${texts}</svg>`;
}

/* Barkod parser — terezi çykarýan içerki barkodlar (00 | kod | agram | kontrol) */
function parseBC(raw) {
  const code = String(raw || '').replace(/\s/g, '');
  if (!/^\d{12,13}$/.test(code)) return null;

  const full = code.length === 12 ? code + ean13Checksum(code) : code;
  if (full.length !== 13) return null;
  if (!isValidBarcodeFormat(full)) return null;

  const prefix = full.slice(0, 2);
  // 00 = terezi agram barkody, 20–29 = içerki agramly barkod
  if (prefix === WEIGHT_BC_PREFIX || (prefix >= '20' && prefix <= '29')) {
    const key = full.slice(2, 7);
    const grams = parseInt(full.slice(7, 12), 10) || 0;
    return { fmt: 'WEIGHT', code: key, plu: key, net: grams };
  }
  return { fmt: 'EAN', code: full, plu: '', net: 0 };
}

function escapeHtml(s){
  return String(s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function fg(g){
  const n = Math.round(Number(g)||0);
  return n ? String(n) : '0';
}
