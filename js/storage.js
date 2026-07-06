'use strict';

/* ══════════════════════════════════════════════════════
   STORAGE — maglumat gatlagy (backend API esasly)
   Harytlar serwerden çekilýär we ITEM_DB-de keş hökmünde
   saklanýar. Üýtgemeler API arkaly serwere ýazylýar.
══════════════════════════════════════════════════════ */

// Serwerden çekilen harytlaryň keşi (ählumumy görnüşde elýeterli)
let ITEM_DB = [];

/* Serwerden harytlary täzeden çekýär (gözleg goldaýar) */
async function refreshItems(search) {
  ITEM_DB = (await API.items.list(search)) || [];
  return ITEM_DB;
}

/* id boýunça keşden tapmak — serwer id-leri san, onclick-de setir
   bolany üçin "loose" deňeşdirme ulanýarys */
function findItem(id){ return ITEM_DB.find(it => String(it.id) === String(id)) || null; }
function findItemByPlu(plu){ return ITEM_DB.find(it => String(it.plu) === String(plu)) || null; }
function normalizeDigits(s){ return String(s || '').replace(/\D/g, ''); }
function comparableKey(s){
  const d = normalizeDigits(s);
  if(!d) return null;
  // leading zero-lary aýyrýarys: "00339" -> "339"
  return String(parseInt(d, 10));
}
function findItemByCode(code){
  const k = comparableKey(code);
  if(!k) return null;
  return ITEM_DB.find(it => comparableKey(it.code) === k) || null;
}
function findItemByBarcode(code){
  const c = (code||'').replace(/\s/g,'');
  if(!c) return null;
  return ITEM_DB.find(it => (it.barcode||'').replace(/\s/g,'') === c) || null;
}

/* ══════════════════════════════════════════════════════
   BARKOD UTILITALARY (EAN-13)
══════════════════════════════════════════════════════ */
function ean13Checksum(digits12){
  let sum = 0;
  for(let i=0;i<12;i++){
    const d = parseInt(digits12[i]);
    sum += (i%2===0) ? d : d*3;
  }
  return (10 - (sum % 10)) % 10;
}

function isValidBarcodeFormat(code){
  code = (code||'').trim().replace(/\s/g,'');
  if(!/^\d{13}$/.test(code)) return false;
  return ean13Checksum(code.slice(0,12)) === parseInt(code[12]);
}

/* Türkmenistanyň GS1 ýurt prefiksi (öňki görnüş üçin). */
const TM_GS1_PREFIX = '483';

/* Terezi agram barkodynyň prefiksi — "00" agramly haryt diýmegi aňladýar. */
const WEIGHT_BC_PREFIX = '00';

/* PLU + agram esasynda terezi görnüşli EAN-13 döretmek.
   Gurluş:  00 | PLU (5 san, nol bilen) | agram-gram (5 san, nol bilen) | kontrol sany
   Mysal:   PLU 321, agram 2510 g  ->  00 00321 02510 + checksum  =  0000321025102 */
function generateEan13FromPlu(plu, gram){
  const pluDigits  = String(plu||'').replace(/\D/g,'').padStart(5,'0').slice(-5);
  const gramDigits = String(Math.round(parseFloat(gram)||0)).replace(/\D/g,'').padStart(5,'0').slice(-5);
  const base12 = (WEIGHT_BC_PREFIX + pluDigits + gramDigits).slice(0,12);
  return base12 + ean13Checksum(base12);
}

function generateEan13FromKey(key, gram){
  const keyDigits  = String(key||'').replace(/\D/g,'').padStart(5,'0').slice(-5);
  const gramDigits = String(Math.round(parseFloat(gram)||0)).replace(/\D/g,'').padStart(5,'0').slice(-5);
  const base12 = (WEIGHT_BC_PREFIX + keyDigits + gramDigits).slice(0,12);
  return base12 + ean13Checksum(base12);
}

/* ══════════════════════════════════════════════════════
   EAN-13 SVG ÇYZGYÇ — CDN-siz, doly offline işleýär.
   13 sanly kody alyp, hakyky skanirläp bolýan barkod
   şekilini (SVG) gaýtaryp berýär.
══════════════════════════════════════════════════════ */
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

  // Çyzgy ölçegleri (modul = bir inçe zolak giňligi)
  const mw = 2, qzL = 11, qzR = 7;
  const barH = 64, guardExtra = 7, textY = barH + 18, height = barH + 22;
  const totalMods = qzL + bits.length + qzR;
  const width = totalMods * mw;

  // Guard zolaklary (aşak süýnýänler): start, merkez, end
  const isGuard = idx => (idx<3) || (idx>=45 && idx<50) || (idx>=92);

  let rects = '';
  for(let i=0;i<bits.length;i++){
    if(bits[i] !== '1') continue;
    const x = (qzL + i) * mw;
    const h = isGuard(i) ? barH + guardExtra : barH;
    rects += `<rect x="${x}" y="0" width="${mw}" height="${h}"/>`;
  }

  // Sanlar (adam okaýan görnüşi)
  const tStyle = `font-family:monospace;font-size:11px;fill:#000`;
  let texts = `<text x="${(qzL-7)*mw}" y="${textY}" style="${tStyle}">${first}</text>`;
  for(let j=0;j<6;j++){
    const cx = (qzL + 3 + j*7 + 3.5) * mw;
    texts += `<text x="${cx}" y="${textY}" text-anchor="middle" style="${tStyle}">${left[j]}</text>`;
  }
  for(let j=0;j<6;j++){
    const cx = (qzL + 50 + j*7 + 3.5) * mw;
    texts += `<text x="${cx}" y="${textY}" text-anchor="middle" style="${tStyle}">${right[j]}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
    viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>
    <g fill="#000">${rects}</g>${texts}</svg>`;
}

/* Barkod parser — terezi çykarýan içerki barkodlar */
function parseBC(code){
  code = code.trim().replace(/\s/g,'');
  if(!/^\d+$/.test(code)) return null;
  const n = code.length;

  if(n===13){
    const pre = parseInt(code.slice(0,2));
    const key = code.slice(2,7);
    const w5  = code.slice(7,12);
    // 00 = terezi agram barkody, 20–29 = içerki agramly barkod.
    // Gurluş: pre | Kod(5) | NETTO-gram(5) | kontrol.  net — GRAMDA.
    if(pre === 0 || (pre>=20 && pre<=29)){
      return {fmt: pre===0 ? 'Agram-00' : 'Agram-13', code:String(parseInt(key)), net: parseInt(w5)};
    }
    return {fmt:'EAN-13', plu: code.slice(2,7).replace(/^0+/,''), gross:0};
  }
  if(n===8){
    return {fmt:'EAN-8', plu:code.slice(0,4).replace(/^0+/,''), gross: parseInt(code.slice(4,8))};
  }
  return {fmt:'PLU', plu:code, gross:0};
}

/* ══════════════════════════════════════════════════════
   CSV (EXCEL) KÖMEKÇILERI — kitaphanasyz, offline
   Excel CSV faýllaryny açýar/saklaýar. Türkmen harplary
   üçin UTF-8 BOM goşulýar.
══════════════════════════════════════════════════════ */

/* Bir öýjügi CSV-howpsuz görnüşe geçirmek */
function csvCell(v){
  v = (v == null ? '' : String(v));
  if(/[",\r\n;]/.test(v)) v = '"' + v.replace(/"/g,'""') + '"';
  return v;
}

/* Setir massiwlerini CSV teksta öwürmek */
function buildCSV(rows, delim){
  delim = delim || ',';
  return rows.map(r => r.map(csvCell).join(delim)).join('\r\n');
}

/* Delimiteri kesgitlemek (Excel: ; , ýa-da tab) */
function detectDelim(text){
  const head = text.split(/\r?\n/)[0] || '';
  const t = (head.match(/\t/g) || []).length;
  const s = (head.match(/;/g) || []).length;
  const c = (head.match(/,/g) || []).length;
  if (t > 0 && t >= s && t >= c) return '\t';
  if (s > 0 && s >= c) return ';';
  return ',';
}

/* Doly CSV parser — dyrnaklary we içerki setir geçişlerini goldaýar */
function parseCSV(text, delim){
  delim = delim || ',';
  const rows = []; let row = []; let field = ''; let inQ = false; let i = 0;
  while(i < text.length){
    const c = text[i];
    if(inQ){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if(c === '"'){ inQ = true; i++; continue; }
    if(c === delim){ row.push(field); field = ''; i++; continue; }
    if(c === '\r'){ i++; continue; }
    if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if(field !== '' || row.length > 0){ row.push(field); rows.push(row); }
  return rows;
}

/* Blob faýly ýüklemek (download) */
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* Faýl ady üçin sene möhüri: 20260621 */
function dateStamp(){
  const d = new Date();
  return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
}

/* ── Umumy kömekçiler ── */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function f3(n){ return Number(n).toFixed(3); }
