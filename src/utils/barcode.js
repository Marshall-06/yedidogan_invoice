'use strict';

/* ══════════════════════════════════════════════════════
   BARCODE — EAN-13
   Terezi / haryt barkody:
   Gurluş: 00 | açar (5 san) | agram (5 san) | kontrol sany
   Mysal:  kod 339 → 00 00339 00000 C
   Açar: Kod (yonekey) ileri, ýok bolsa PLU. Uzynlygy dürli bolup biler —
   diňe sanlar alynýar, 5 sanlyga doldurylýar (ýa-da soňky 5).
══════════════════════════════════════════════════════ */
const TM_GS1_PREFIX = '483';
const WEIGHT_BC_PREFIX = '00';

function ean13Checksum(digits12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function isValidBarcode(code) {
  code = String(code || '').replace(/\s/g, '');
  if (!/^\d{13}$/.test(code)) return false;
  return ean13Checksum(code.slice(0, 12)) === parseInt(code[12], 10);
}

function digitsOnly(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

/* Kod ýa-da PLU-dan 5 sanly açar — herhili uzynlyk / format */
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

/* Haryt bazasy üçin: Kod/PLU-dan barkod (agram bölegi default 00000 —
   hakyky agram terezi barkodynda gelýär) */
function generateItemBarcode({ code, plu, gram } = {}) {
  const key = resolveBarcodeKey(code, plu);
  if (!key) return null;
  return generateEan13FromKey(key, gram || 0);
}

module.exports = {
  TM_GS1_PREFIX,
  WEIGHT_BC_PREFIX,
  ean13Checksum,
  isValidBarcode,
  digitsOnly,
  resolveBarcodeKey,
  generateEan13FromKey,
  generateEan13FromPlu,
  generateItemBarcode,
};
