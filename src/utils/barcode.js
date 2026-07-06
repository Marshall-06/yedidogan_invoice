'use strict';

/* ══════════════════════════════════════════════════════
   BARCODE — EAN-13 (frontend bilen birmeňzeş logika)
   Terezi agram barkody:
   Gurluş: 00 | PLU (5 san) | agram-gram (5 san) | kontrol sany
   Mysal:  PLU 321, agram 2510 g -> 00 00321 02510 2 = 0000321025102
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

function generateEan13FromKey(key, gram) {
  const keyDigits = String(key || '').replace(/\D/g, '').padStart(5, '0').slice(-5);
  const gramDigits = String(Math.round(parseFloat(gram) || 0))
    .replace(/\D/g, '')
    .padStart(5, '0')
    .slice(-5);
  const base12 = (WEIGHT_BC_PREFIX + keyDigits + gramDigits).slice(0, 12);
  return base12 + ean13Checksum(base12);
}

// Backward-compat alias (esasan köne atlandyryşlar üçin).
function generateEan13FromPlu(plu, gram) {
  return generateEan13FromKey(plu, gram);
}

module.exports = {
  TM_GS1_PREFIX,
  WEIGHT_BC_PREFIX,
  ean13Checksum,
  isValidBarcode,
  generateEan13FromKey,
  generateEan13FromPlu,
};
