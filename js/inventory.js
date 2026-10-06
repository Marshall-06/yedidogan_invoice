// 'use strict';

// /* ══════════════════════════════════════════════════════
//    INVENTORY — "Harytlar Bazasy" sahypasynyň logikasy
//    Forma (goş / üýtget), CRUD tablisa, barkod görkezme.
// ══════════════════════════════════════════════════════ */

// // Häzir redaktirlenýän harydyň id-si (null = täze goşmak rejimi)
// let editingItemId = null;

// /* ── Forma elementleri (barkod ýok — ol awtomatiki döreýär) ── */
// const IF = {
//   code: () => document.getElementById('if-code'),
//   plu: () => document.getElementById('if-plu'),
//   name: () => document.getElementById('if-name'),
//   tare: () => document.getElementById('if-tare'),
//   mm: () => document.getElementById('if-mm'),
// };

// function resolveBarcodeKeyLocal(code, plu) {
//   const dig = (v) => String(v || '').replace(/\D/g, '');
//   const raw = dig(code) || dig(plu);
//   if (!raw) return null;
//   return raw.padStart(5, '0').slice(-5);
// }

// function previewItemBarcode(code, plu) {
//   const key = resolveBarcodeKeyLocal(code, plu);
//   if (!key || typeof generateEan13FromKey !== 'function') return '';
//   return generateEan13FromKey(key, 0);
// }

// function refreshBarcodePreview() {
//   const el = document.getElementById('if-barcode-preview');
//   if (!el) return;
//   const code = IF.code()?.value || '';
//   const plu = IF.plu()?.value || '';
//   const bc = previewItemBarcode(code, plu);
//   el.textContent = bc || '—';
// }

// function clearItemForm() {
//   Object.values(IF).forEach(get => {
//     const el = get();
//     if (!el) return;
//     if (el.tagName === 'SELECT') el.selectedIndex = 0;
//     else el.value = '';
//   });
//   refreshBarcodePreview();
// }

// /* Bazadaky iň uly sanly Kod/PLU + 1 (nol padding saklanýar).
//    El bilen ýazylsa şol baha ulanylýar. */
// function nextAutoNumeric(values, fallback = 1) {
//   let maxNum = 0;
//   let pad = 0;
//   for (const v of values) {
//     const digits = String(v || '').replace(/\D/g, '');
//     if (!digits) continue;
//     const n = parseInt(digits, 10);
//     if (!Number.isFinite(n)) continue;
//     if (n > maxNum || (n === maxNum && digits.length > pad)) {
//       maxNum = n;
//       pad = digits.length;
//     }
//   }
//   const next = (maxNum > 0 ? maxNum : fallback - 1) + 1;
//   if (pad > 0) return String(next).padStart(Math.max(pad, String(next).length), '0');
//   return String(next);
// }

// function suggestNextCode() {
//   return nextAutoNumeric((ITEM_DB || []).map(it => it.code), 1);
// }

// async function suggestNextCodeAsync() {
//   try {
//     const res = await API.items.nextCode();
//     if (res && res.code != null) return String(res.code);
//     return suggestNextCode();
//   } catch (e) {
//     return suggestNextCode();
//   }
// }

// function setItemFormMode(isEdit) {
//   const title = document.getElementById('inv-form-title');
//   const submit = document.getElementById('if-submit');
//   if (!title || !submit) return;
//   if (isEdit) {
//     title.textContent = '✎ Harydy üýtget';
//     submit.textContent = '✓ Ýatda sakla';
//   } else {
//     title.textContent = '＋ Täze haryt goş';
//     submit.textContent = '＋ Baza goş';
//   }
// }

// async function openNewItem() {
//   editingItemId = null;
//   clearItemForm();
//   setItemFormMode(false);
//   navigate('inventory-form');
//   const nameEl = IF.name();
//   if (nameEl) setTimeout(() => nameEl.focus(), 50);
// }

// function cancelEditItem() {
//   editingItemId = null;
//   clearItemForm();
//   setItemFormMode(false);
//   navigate('inventory');
// }

// /* Tablisadan "Üýtget" — aýratyn forma sahypasy */
// async function startEditItem(id) {
//   let it = findItem(id);
//   if (!it) {
//     try { it = await API.items.get(id); } catch (e) { /* ignore */ }
//   }
//   if (!it) {
//     alert('Haryt tapylmady');
//     return;
//   }
//   editingItemId = id;
//   IF.code().value = it.code || '';
//   IF.plu().value = it.plu || '';
//   IF.name().value = it.name || '';
//   IF.tare().value = it.tare || '';
//   IF.mm().value = it.mm || '';
//   refreshBarcodePreview();
//   const prev = document.getElementById('if-barcode-preview');
//   if (prev && it.barcode) prev.textContent = String(it.barcode).replace(/\s/g, '');
//   setItemFormMode(true);
//   navigate('inventory-form');
// }

// /* Forma "goş" ýa-da "ýatda sakla" — barkod Kod/PLU-dan awtomatiki */
// async function submitItemForm() {
//   const name = IF.name().value.trim();
//   const mm = IF.mm().value.trim();
//   const tare = IF.tare().value.trim();
//   let plu = IF.plu().value.trim();
//   let code = IF.code().value.trim();

//   if (!name) {
//     alert('Harydyň adyny giriziň!');
//     return;
//   }

//   // Täze haryt: boş Kod bolsa awto-increment; PLU diňe el bilen
//   if (!editingItemId) {
//     if (!code) {
//       code = await suggestNextCodeAsync();
//       if (IF.code()) IF.code().value = code;
//     }
//     refreshBarcodePreview();
//   }

//   if (!code) {
//     alert('Kody giriziň ýa-da awto doldurmaga rugsat beriň!');
//     return;
//   }

//   const payload = {
//     plu,
//     name,
//     gram: 0,
//     mm: mm || 0,
//     code,
//     tare: tare || 0,
//   };

//   // Mode / Self / Label / Shop / gram UI-da ýok — üýtgedende bazadaky bahalar saklanýar
//   if (editingItemId) {
//     const existing = findItem(editingItemId);
//     if (existing) {
//       payload.gram = existing.gram ?? 0;
//       payload.mode = existing.mode ?? null;
//       payload.self = existing.self ?? '';
//       payload.label = existing.label ?? '';
//       payload.shop = existing.shop ?? '';
//       // Kod üýtgemedik bolsa Excel/awto barkody sakla; üýtgän bolsa serwer täzeden döredýär
//       if (existing.barcode && String(existing.code || '') === code) {
//         payload.barcode = existing.barcode;
//       }
//     }
//   } else {
//     payload.mode = null;
//     payload.self = '';
//     payload.label = '';
//     payload.shop = '';
//     // barcode iberilmeýär — serwer Kod/PLU-dan döredýär
//   }

//   try {
//     if (editingItemId) await API.items.update(editingItemId, payload);
//     else await API.items.create(payload);
//   } catch (e) {
//     alert('Ýalňyşlyk: ' + e.message);
//     return;
//   }

//   cancelEditItem();
//   renderInventory();
// }

// const INV_COLS = 7;

// function invDisp(v, zeroEmpty) {
//   if (v == null || String(v).trim() === '') return '';
//   if (zeroEmpty && !(Number(v))) return '';
//   return escapeHtml(String(v));
// }

// /* ══ CRUD tablisany çyzmak (serwerden çekýär) ══ */
// async function renderInventory() {
//   const tbody = document.getElementById('inv-tbody');
//   const countEl = document.getElementById('inv-count');
//   const q = (document.getElementById('inv-search').value || '').trim();

//   try {
//     // Ähli harytlar — diňe ilkinji 200 däl
//     await refreshAllItems(q);
//   } catch (e) {
//     countEl.textContent = 0;
//     tbody.innerHTML = `<tr><td colspan="${INV_COLS}" class="inv-empty">
//       Serwere birikip bolmady — backend işleýärmi?<br><small>${escapeHtml(e.message)}</small>
//     </td></tr>`;
//     return;
//   }

//   const total = (typeof ITEM_META !== 'undefined' && ITEM_META && ITEM_META.total != null)
//     ? ITEM_META.total
//     : ITEM_DB.length;
//   countEl.textContent = total;

//   if (ITEM_DB.length === 0) {
//     tbody.innerHTML = `<tr><td colspan="${INV_COLS}" class="inv-empty">
//       ${q ? 'Gözleg boýunça haryt tapylmady.' : 'Bazada haryt ýok — ýokardaky formadan goşuň.'}
//     </td></tr>`;
//     return;
//   }

//   tbody.innerHTML = ITEM_DB.map((it, i) => {
//     return `
//     <tr>
//       <td class="mono col-idx" data-label="#">${i + 1}</td>
//       <td class="mono" data-label="PLU">${invDisp(it.plu)}</td>
//       <td class="tl" data-label="Ady"><span class="inv-name">${escapeHtml(it.name || '')}</span></td>
//       <td data-label="Kod">${invDisp(it.code)}</td>
//       <td class="mono" data-label="Ini (mm)">${invDisp(it.mm, true)}</td>
//       <td class="mono" data-label="Gilza (g)">${invDisp(it.tare, true)}</td>
//       <td data-label="Amallar">
//         <div class="row-actions">
//           <button class="btn btn-sm btn-add admin-only" onclick="openWorkOrderFromItem('${it.id}')" title="Work Order">🏭 WO</button>
//           <button class="btn btn-sm btn-edit admin-only" onclick="startEditItem('${it.id}')">✎ Üýtget</button>
//           <button class="btn btn-sm btn-trash admin-only" onclick="removeItem('${it.id}')">✕</button>
//         </div>
//       </td>
//     </tr>`;
//   }).join('');
// }

// const renderInventoryDebounced = debounce(() => { renderInventory(); }, 280);

// async function removeItem(id) {
//   const it = findItem(id);
//   if (!it) return;
//   if (!confirm(`"${it.name}" harydyny bazadan pozmaly my?`)) return;
//   try {
//     await API.items.remove(it.id);
//   } catch (e) {
//     alert('Ýalňyşlyk: ' + e.message);
//     return;
//   }
//   if (String(editingItemId) === String(id)) cancelEditItem();
//   renderInventory();
// }

// /* ══════════════════════════════════════════════════════
//    BARKOD GÖRKEZME / ÇYKARMA
//    Bazada saklanan barkody görkezýär.
// ══════════════════════════════════════════════════════ */
// function showBarcode(id) {
//   const it = findItem(id);
//   if (!it) return;

//   const code = (it.barcode || '').replace(/\s/g, '');
//   if (!code) {
//     alert('Bu harydyň bazada barkody ýok. Excel import arkaly barkod goşuň.');
//     return;
//   }

//   document.getElementById('bc-modal-title').textContent = 'Barkod';
//   document.getElementById('bc-label-name').textContent = it.name || '(adsyz)';
//   document.getElementById('bc-label-meta').textContent =
//     `PLU ${it.plu || '—'}` + (it.code ? ` · Kod ${it.code}` : '') + (it.mm ? ` · ${it.mm}mm` : '');

//   renderBarcodeSvg(code);
//   document.getElementById('barcode-modal-overlay').classList.add('open');
// }

// /* Öz EAN-13 SVG çyzgyjymyz — internet/CDN gerek däl */
// function renderBarcodeSvg(code) {
//   const wrap = document.getElementById('bc-svg-wrap');
//   const svg = ean13Svg(code);
//   wrap.innerHTML = svg || `<div class="bc-fallback">${escapeHtml(code)}</div>`;
// }

// function closeBarcodeModal() {
//   document.getElementById('barcode-modal-overlay').classList.remove('open');
// }

// /* ══════════════════════════════════════════════════════
//    EXCEL EXPORT / IMPORT
//    Excel 2013–2026: .xlsx / .xlsm / .xlsb / .xls + CSV/TXT
// ══════════════════════════════════════════════════════ */
// /* Import / export bir format — çykarylan faýl täzeden import edilip bilner */
// const EXCEL_HEADERS = [
//   'Kod', 'PLU', 'Ady', 'Netto_g', 'Gilza_g', 'Brutto_g', 'Ini_mm',
//   'Gornush', 'Self', 'Label', 'Shop', 'Barkod'
// ];

// const EXCEL_BIN_EXT = /\.(xlsx|xlsm|xlsb|xls|ods|fods|uos|sylk|slk|dif|dbf|prn|eth)$/i;
// const EXCEL_TEXT_EXT = /\.(csv|txt|tsv)$/i;

// function ensureXlsxLib() {
//   if (typeof XLSX === 'undefined' || !XLSX.read || !XLSX.utils) {
//     throw new Error('Excel okaýjy ýüklenmedi — sahypany täzeläň (Ctrl+F5).');
//   }
// }

// function dateStamp() {
//   const d = new Date();
//   const p = (n) => String(n).padStart(2, '0');
//   return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
// }

// function downloadBlob(blob, filename) {
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement('a');
//   a.href = url;
//   a.download = filename;
//   a.rel = 'noopener';
//   document.body.appendChild(a);
//   a.click();
//   a.remove();
//   setTimeout(() => URL.revokeObjectURL(url), 1500);
// }

// function csvCell(val) {
//   const s = String(val == null ? '' : val);
//   if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
//   return s;
// }

// function buildCSV(rows, delim) {
//   const d = delim || ';';
//   return rows.map(r => (r || []).map(csvCell).join(d)).join('\r\n');
// }

// function detectDelim(text) {
//   const sample = String(text || '').split(/\r?\n/).slice(0, 5).join('\n');
//   const counts = {
//     ';': (sample.match(/;/g) || []).length,
//     ',': (sample.match(/,/g) || []).length,
//     '\t': (sample.match(/\t/g) || []).length
//   };
//   if (counts['\t'] >= counts[';'] && counts['\t'] >= counts[',']) return '\t';
//   if (counts[';'] >= counts[',']) return ';';
//   return ',';
// }

// function parseCSV(text, delim) {
//   const d = delim || ';';
//   const rows = [];
//   let row = [];
//   let cell = '';
//   let inQ = false;
//   const src = String(text || '').replace(/^\uFEFF/, '');
//   for (let i = 0; i < src.length; i++) {
//     const ch = src[i];
//     const next = src[i + 1];
//     if (inQ) {
//       if (ch === '"' && next === '"') { cell += '"'; i++; continue; }
//       if (ch === '"') { inQ = false; continue; }
//       cell += ch;
//       continue;
//     }
//     if (ch === '"') { inQ = true; continue; }
//     if (ch === d) { row.push(cell); cell = ''; continue; }
//     if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
//     if (ch === '\r') {
//       if (next === '\n') continue;
//       row.push(cell); rows.push(row); row = []; cell = '';
//       continue;
//     }
//     cell += ch;
//   }
//   if (cell.length || row.length) {
//     row.push(cell);
//     rows.push(row);
//   }
//   return rows;
// }

// function collectAllItemsForExport() {
//   const pageSize = 500;
//   let offset = 0;
//   let total = Infinity;
//   let all = [];
//   return (async () => {
//     while (offset < total) {
//       const res = await API.items.list('', { limit: pageSize, offset });
//       const chunk = Array.isArray(res) ? res : (res && res.data) || [];
//       const meta = (!Array.isArray(res) && res && res.meta) ? res.meta : null;
//       total = meta && meta.total != null ? meta.total : chunk.length;
//       all = all.concat(chunk);
//       offset += chunk.length;
//       if (!chunk.length) break;
//     }
//     all.sort((a, b) => {
//       const ak = String(a.code || '').replace(/\D/g, '');
//       const bk = String(b.code || '').replace(/\D/g, '');
//       const an = ak ? parseInt(ak, 10) : Number.POSITIVE_INFINITY;
//       const bn = bk ? parseInt(bk, 10) : Number.POSITIVE_INFINITY;
//       if (an !== bn) return an - bn;
//       return String(a.name || '').localeCompare(String(b.name || ''));
//     });
//     return all;
//   })();
// }

// function exportSheetNum(val) {
//   if (val == null || String(val).trim() === '') return '';
//   const v = Number(val);
//   if (!Number.isFinite(v)) return String(val).trim();
//   if (Math.floor(v) === v) return v;
//   return Math.round(v);
// }

// function itemsToSheetRows(all) {
//   const rows = [EXCEL_HEADERS.slice()];
//   all.forEach(it => {
//     const code = String(it.code || '').trim();
//     const plu = it.plu || '';
//     const name = it.name || '';
//     const tare = Math.max(0, Math.round(Number(it.tare) || 0));
//     const brutto = Math.max(0, Math.round(Number(it.gram) || 0));
//     const netto = Math.max(0, brutto - tare);
//     const mm = Math.max(0, Math.round(Number(it.mm) || 0));
//     rows.push([
//       code,
//       plu,
//       name,
//       exportSheetNum(netto),
//       exportSheetNum(tare),
//       exportSheetNum(brutto),
//       exportSheetNum(mm),
//       it.mode || '',
//       it.self || '',
//       it.label || '',
//       it.shop || '',
//       String(it.barcode || '').replace(/\s/g, '')
//     ]);
//   });
//   return rows;
// }

// function writeItemsWorkbook(rows, filename) {
//   ensureXlsxLib();
//   const ws = XLSX.utils.aoa_to_sheet(rows);
//   ws['!cols'] = EXCEL_HEADERS.map((h, i) => ({
//     wch: Math.max(10, String(h).length + 2, ...rows.slice(1, 40).map(r => String(r[i] == null ? '' : r[i]).length))
//   }));
//   const wb = XLSX.utils.book_new();
//   XLSX.utils.book_append_sheet(wb, ws, 'Harytlar');
//   const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
//   const blob = new Blob([out], {
//     type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//   });
//   downloadBlob(blob, filename);
// }

// async function exportItems() {
//   let all = [];
//   try {
//     all = await collectAllItemsForExport();
//   } catch (e) {
//     alert('Export başartmady: ' + e.message);
//     return;
//   }
//   if (all.length === 0) {
//     alert('Bazada haryt ýok — export ediljek zat ýok.');
//     return;
//   }

//   const rows = itemsToSheetRows(all);
//   const stamp = dateStamp();

//   try {
//     writeItemsWorkbook(rows, 'harytlar_' + stamp + '.xlsx');
//   } catch (e) {
//     const csv = buildCSV(rows, ';');
//     const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
//     downloadBlob(blob, 'harytlar_' + stamp + '.csv');
//     if (e && e.message) console.warn('Excel export fallback CSV:', e.message);
//   }
// }

// /** Boş şablon — import bilen bir sütunlar (diňe başlyk) */
// function exportItemsTemplate() {
//   const stamp = dateStamp();
//   const rows = [EXCEL_HEADERS.slice()];
//   try {
//     writeItemsWorkbook(rows, 'harytlar_shablon_' + stamp + '.xlsx');
//   } catch (e) {
//     const csv = buildCSV(rows, ';');
//     const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
//     downloadBlob(blob, 'harytlar_shablon_' + stamp + '.csv');
//   }
// }

// function triggerImport() {
//   document.getElementById('import-file').click();
// }

// function normColHeader(h) {
//   return String(h || '')
//     .replace(/^\uFEFF/, '')
//     .trim()
//     .toLowerCase()
//     .replace(/[()]/g, '')
//     .replace(/[\s./-]+/g, '_')
//     .replace(/_+/g, '_')
//     .replace(/^_|_$/g, '');
// }

// function findCol(header, names) {
//   const norm = header.map(normColHeader);
//   for (const n of names) {
//     const key = normColHeader(n);
//     const i = norm.findIndex(h => h === key);
//     if (i >= 0) return i;
//   }
//   for (const n of names) {
//     const key = normColHeader(n);
//     const i = norm.findIndex(h => h === key || h.includes(key) || key.includes(h));
//     if (i >= 0) return i;
//   }
//   return -1;
// }

// function sheetCellText(sheet, r, c) {
//   const addr = XLSX.utils.encode_cell({ r, c });
//   const cell = sheet[addr];
//   if (!cell) return '';
//   // Excel san öýjükleri: 340 → "340", 340.0 formaty ýitmesin
//   if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
//     if (Math.floor(cell.v) === cell.v) return String(cell.v);
//     const rounded = Math.round(cell.v);
//     if (Math.abs(cell.v - rounded) < 1e-9) return String(rounded);
//     return String(cell.v);
//   }
//   if (cell.w != null && String(cell.w).trim() !== '') return String(cell.w).trim();
//   if (cell.v != null) return String(cell.v).trim();
//   return '';
// }

// function sheetToRows(sheet) {
//   ensureXlsxLib();
//   const ref = sheet['!ref'];
//   if (!ref) return [];
//   const range = XLSX.utils.decode_range(ref);
//   const rows = [];
//   for (let r = range.s.r; r <= range.e.r; r++) {
//     const cells = [];
//     for (let c = range.s.c; c <= range.e.c; c++) {
//       cells.push(sheetCellText(sheet, r, c));
//     }
//     rows.push(cells);
//   }
//   return rows;
// }

// function readWorkbookFromBuffer(buf) {
//   ensureXlsxLib();
//   const opts = {
//     type: 'array',
//     cellDates: true,
//     cellNF: false,
//     cellText: true,
//     raw: false,
//     codepage: 65001
//   };
//   try {
//     return XLSX.read(buf, opts);
//   } catch (e1) {
//     // Käbir .xls / köne faýllar UTF-8 däl codepage bilen gelýär
//     try {
//       return XLSX.read(buf, { ...opts, codepage: 1251 });
//     } catch (e2) {
//       return XLSX.read(buf, { type: 'array' });
//     }
//   }
// }

// function handleImportFile(input) {
//   const file = input.files && input.files[0];
//   if (!file) return;
//   const lower = file.name.toLowerCase();
//   const isBin = EXCEL_BIN_EXT.test(lower)
//     || /sheet|excel|spreadsheet|ms-excel|opendocument/i.test(file.type || '');
//   const isText = EXCEL_TEXT_EXT.test(lower) || /^text\//i.test(file.type || '');

//   if (isBin || (!isText && !lower.includes('.'))) {
//     const reader = new FileReader();
//     reader.onload = e => {
//       try {
//         const wb = readWorkbookFromBuffer(new Uint8Array(e.target.result));
//         const name = (wb.SheetNames && wb.SheetNames[0]) || '';
//         const sheet = name ? wb.Sheets[name] : null;
//         if (!sheet) throw new Error('Excel faýlynda list tapylmady.');
//         importItemsRows(sheetToRows(sheet));
//       } catch (err) {
//         alert('Import ýalňyşlygy: ' + (err && err.message ? err.message : err));
//       }
//       input.value = '';
//     };
//     reader.onerror = () => {
//       alert('Faýl okalmak başartmady.');
//       input.value = '';
//     };
//     reader.readAsArrayBuffer(file);
//     return;
//   }

//   const reader = new FileReader();
//   reader.onload = e => {
//     try {
//       const text = String(e.target.result || '').replace(/^\uFEFF/, '');
//       const delim = detectDelim(text);
//       importItemsRows(parseCSV(text, delim));
//     } catch (err) {
//       alert('Import ýalňyşlygy: ' + (err && err.message ? err.message : err));
//     }
//     input.value = '';
//   };
//   reader.onerror = () => {
//     alert('Faýl okalmak başartmady.');
//     input.value = '';
//   };
//   reader.readAsText(file, 'UTF-8');
// }

// async function importItemsRows(rows) {
//   if (!rows || rows.length < 2) {
//     alert('Faýl boş ýa-da diňe başlyk hatary bar.');
//     return;
//   }

//   const header = rows[0].map(h => String(h == null ? '' : h).trim());
//   const col = {
//     code: findCol(header, ['kod', 'code']),
//     plu: findCol(header, ['plu']),
//     name: findCol(header, ['ady', 'name', 'ad', 'haryt', 'harydyn_ady', 'naimenovanie']),
//     netto: findCol(header, ['netto', 'net', 'netto_g']),
//     brutto: findCol(header, ['brutto', 'gross', 'gram', 'agram', 'brutto_g']),
//     mm: findCol(header, ['ini', 'width', 'mm', 'ini_mm']),
//     tare: findCol(header, ['gilza', 'tara', 'tare', 'gilza_g', 'gilza_kg']),
//     mode: findCol(header, ['gornush', 'görnüş', 'mode', 'gorunus']),
//     self: findCol(header, ['self']),
//     label: findCol(header, ['label']),
//     shop: findCol(header, ['shop', 'sklad']),
//     barcode: findCol(header, ['barkod', 'barcode'])
//   };
//   if (col.code < 0) {
//     alert('Sütünler tapylmady. Iň bolmanda "Kod" sütuny bolmaly.\n\nTapylan başlyklar: ' + header.join(' | '));
//     return;
//   }

//   const get = (cells, c) => (c >= 0 && cells[c] != null) ? String(cells[c]).trim() : '';

//   const cleanCode = (raw) => {
//     let s = String(raw || '').trim();
//     if (!s) return '';
//     if (/^\d+[.,]\d+$/.test(s)) {
//       const n = Number(s.replace(',', '.'));
//       if (Number.isFinite(n) && Math.floor(n) === n) s = String(n);
//     } else if (/^\d+\.?\d*e[+-]?\d+$/i.test(s)) {
//       const n = Number(s);
//       if (Number.isFinite(n)) s = String(Math.round(n));
//     }
//     return s;
//   };

//   const toNum = (s) => {
//     s = String(s || '').trim();
//     if (!s) return 0;
//     s = s.replace(/\s/g, '').replace(',', '.');
//     const v = parseFloat(s);
//     return Number.isFinite(v) ? v : 0;
//   };

//   const payloadRows = [];
//   let skipped = 0;
//   for (let i = 1; i < rows.length; i++) {
//     const cells = rows[i];
//     if (!cells || cells.join('').trim() === '') continue;
//     const code = cleanCode(get(cells, col.code));
//     const plu = get(cells, col.plu);
//     const nameRaw = col.name >= 0 ? get(cells, col.name) : '';
//     if (!code) { skipped += 1; continue; }
//     const name = nameRaw || plu || ('Haryt ' + code);

//     const tareRaw = col.tare >= 0 ? get(cells, col.tare) : '';
//     const nettoRaw = col.netto >= 0 ? get(cells, col.netto) : '';
//     const bruttoRaw = col.brutto >= 0 ? get(cells, col.brutto) : '';
//     const tare = tareRaw !== '' ? Math.max(0, Math.round(toNum(tareRaw))) : 0;
//     const netto = nettoRaw !== '' ? Math.max(0, Math.round(toNum(nettoRaw))) : 0;

//     const row = { code, name };
//     if (plu) row.plu = plu;

//     // Netto + Gilza → Brutto (gram); diňe brutto bolsa ony al
//     if (nettoRaw !== '') {
//       row.netto = netto;
//       row.tare = tare;
//       row.gram = Math.max(0, netto + tare);
//     } else if (bruttoRaw !== '') {
//       row.gram = Math.max(0, Math.round(toNum(bruttoRaw)));
//       if (tareRaw !== '') row.tare = tare;
//     } else if (tareRaw !== '') {
//       row.tare = tare;
//     }

//     if (col.mm >= 0 && get(cells, col.mm) !== '') row.mm = toNum(get(cells, col.mm));
//     if (col.mode >= 0 && get(cells, col.mode) !== '') row.mode = get(cells, col.mode);
//     if (col.self >= 0 && get(cells, col.self) !== '') row.self = get(cells, col.self);
//     if (col.label >= 0 && get(cells, col.label) !== '') row.label = get(cells, col.label);
//     if (col.shop >= 0 && get(cells, col.shop) !== '') row.shop = get(cells, col.shop);
//     const bc = col.barcode >= 0 ? get(cells, col.barcode).replace(/\s/g, '') : '';
//     if (bc) row.barcode = bc;
//     payloadRows.push(row);
//   }

//   if (payloadRows.length === 0) {
//     alert('Import ediljek dogry setir tapylmady.\n\nKod sütuny hökmany. Ady boş bolsa Kod/PLU ulanylýar.'
//       + (skipped ? `\n\nKod boş bolan ${skipped} setir geçirildi.` : ''));
//     return;
//   }

//   let added = 0, updated = 0, skippedSrv = 0, total = payloadRows.length;
//   try {
//     const res = await API.items.import(payloadRows);
//     added = res ? (res.added || 0) : 0;
//     updated = res ? (res.updated || 0) : 0;
//     skippedSrv = res ? (res.skipped || 0) : 0;
//     total = res && res.total != null ? res.total : total;
//   } catch (e) {
//     alert('Import ýalňyşlygy: ' + e.message);
//     return;
//   }

//   const searchEl = document.getElementById('inv-search');
//   if (searchEl) searchEl.value = '';
//   await renderInventory();
//   const skipNote = (skipped + skippedSrv) ? `\n${skipped + skippedSrv} setir geçirildi.` : '';
//   alert(`Import tamamlandy (${total} setir):\n${added} täze haryt goşuldy\n${updated} haryt täzelendi${skipNote}`);
// }

// /* Etiketkany çap etmek — diňe barkod etiketkasy çykýar */
// function printBarcode() {
//   document.body.classList.add('printing-barcode');
//   const cleanup = () => {
//     document.body.classList.remove('printing-barcode');
//     window.removeEventListener('afterprint', cleanup);
//   };
//   window.addEventListener('afterprint', cleanup);
//   window.print();
// }





'use strict';

/* ══════════════════════════════════════════════════════
   INVENTORY — "Harytlar Bazasy" sahypasynyň logikasy
   Forma (goş / üýtget), CRUD tablisa, barkod görkezme.
══════════════════════════════════════════════════════ */

// Häzir redaktirlenýän harydyň id-si (null = täze goşmak rejimi)
let editingItemId = null;

/* ── Forma elementleri (barkod ýok — ol awtomatiki döreýär) ── */
const IF = {
  code: () => document.getElementById('if-code'),
  plu: () => document.getElementById('if-plu'),
  name: () => document.getElementById('if-name'),
  tare: () => document.getElementById('if-tare'),
  mm: () => document.getElementById('if-mm'),
};

function resolveBarcodeKeyLocal(code, plu) {
  const dig = (v) => String(v || '').replace(/\D/g, '');
  const raw = dig(code) || dig(plu);
  if (!raw) return null;
  return raw.padStart(5, '0').slice(-5);
}

function previewItemBarcode(code, plu) {
  const key = resolveBarcodeKeyLocal(code, plu);
  if (!key || typeof generateEan13FromKey !== 'function') return '';
  return generateEan13FromKey(key, 0);
}

function refreshBarcodePreview() {
  const el = document.getElementById('if-barcode-preview');
  if (!el) return;
  const code = IF.code()?.value || '';
  const plu = IF.plu()?.value || '';
  const bc = previewItemBarcode(code, plu);
  el.textContent = bc || '—';
}

function clearItemForm() {
  Object.values(IF).forEach(get => {
    const el = get();
    if (!el) return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  refreshBarcodePreview();
}

/* Bazadaky iň uly sanly Kod/PLU + 1 (bazadaky format saklanýar:
   "0000421" → "0000422", "421" → "422"). El bilen ýazylsa şol baha ulanylýar. */
function nextAutoNumeric(values, fallback = 1) {
  let maxNum = 0;
  let pad = 0;
  for (const v of values) {
    const digits = String(v || '').replace(/\D/g, '');
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

function suggestNextCode() {
  return nextAutoNumeric((ITEM_DB || []).map(it => it.code), 1);
}

async function suggestNextCodeAsync() {
  try {
    const res = await API.items.nextCode();
    if (res && res.code != null) return String(res.code);
    return suggestNextCode();
  } catch (e) {
    return suggestNextCode();
  }
}

function setItemFormMode(isEdit) {
  const title = document.getElementById('inv-form-title');
  const submit = document.getElementById('if-submit');
  if (!title || !submit) return;
  if (isEdit) {
    title.textContent = '✎ Harydy üýtget';
    submit.textContent = '✓ Ýatda sakla';
  } else {
    title.textContent = '＋ Täze haryt goş';
    submit.textContent = '＋ Baza goş';
  }
}

async function openNewItem() {
  editingItemId = null;
  clearItemForm();
  setItemFormMode(false);
  navigate('inventory-form');
  const nameEl = IF.name();
  if (nameEl) setTimeout(() => nameEl.focus(), 50);
}

function cancelEditItem() {
  editingItemId = null;
  clearItemForm();
  setItemFormMode(false);
  navigate('inventory');
}

/* Tablisadan "Üýtget" — aýratyn forma sahypasy */
async function startEditItem(id) {
  let it = findItem(id);
  if (!it) {
    try { it = await API.items.get(id); } catch (e) { /* ignore */ }
  }
  if (!it) {
    alert('Haryt tapylmady');
    return;
  }
  editingItemId = id;
  IF.code().value = it.code || '';
  IF.plu().value = it.plu || '';
  IF.name().value = it.name || '';
  IF.tare().value = it.tare ?? '';
  IF.mm().value = it.mm ?? '';
  refreshBarcodePreview();
  const prev = document.getElementById('if-barcode-preview');
  if (prev && it.barcode) prev.textContent = String(it.barcode).replace(/\s/g, '');
  setItemFormMode(true);
  navigate('inventory-form');
}

/* Forma "goş" ýa-da "ýatda sakla" — barkod Kod/PLU-dan awtomatiki */
async function submitItemForm() {
  const name = IF.name().value.trim();
  const mm = parseFloat(IF.mm().value.trim().replace(',', '.')) || 0;
  const tare = parseFloat(IF.tare().value.trim().replace(',', '.')) || 0;
  let plu = IF.plu().value.trim();
  let code = IF.code().value.trim();

  if (!name) {
    alert('Harydyň adyny giriziň!');
    return;
  }

  if (!editingItemId) {
    if (!code) {
      code = await suggestNextCodeAsync();
      if (IF.code()) IF.code().value = code;
    }
    refreshBarcodePreview();
  }

  if (!code) {
    alert('Kody giriziň ýa-da awto doldurmaga rugsat beriň!');
    return;
  }

  const payload = {
    plu,
    name,
    gram: 0,
    mm: mm || 0,
    code,
    tare: tare || 0,
  };

  if (editingItemId) {
    const existing = findItem(editingItemId);
    if (existing) {
      payload.gram = existing.gram ?? 0;
      payload.mode = existing.mode ?? null;
      payload.self = existing.self ?? '';
      payload.label = existing.label ?? '';
      payload.shop = existing.shop ?? '';
      if (existing.barcode && String(existing.code || '') === code) {
        payload.barcode = existing.barcode;
      }
    }
  } else {
    payload.mode = null;
    payload.self = '';
    payload.label = '';
    payload.shop = '';
  }

  try {
    if (editingItemId) await API.items.update(editingItemId, payload);
    else await API.items.create(payload);
  } catch (e) {
    alert('Ýalňyşlyk: ' + e.message);
    return;
  }

  cancelEditItem();
  renderInventory();
}

const INV_COLS = 7;

function invDisp(v, zeroEmpty) {
  if (v == null || String(v).trim() === '') return '';
  if (zeroEmpty && !(Number(v))) return '';
  return escapeHtml(String(v));
}

/* ══ CRUD tablisany çyzmak (serwerden çekýär) ══ */
async function renderInventory() {
  const tbody = document.getElementById('inv-tbody');
  const countEl = document.getElementById('inv-count');
  const q = (document.getElementById('inv-search').value || '').trim();

  try {
    await refreshAllItems(q);
  } catch (e) {
    countEl.textContent = 0;
    tbody.innerHTML = `<tr><td colspan="${INV_COLS}" class="inv-empty">
      Serwere birikip bolmady — backend işleýärmi?<br><small>${escapeHtml(e.message)}</small>
    </td></tr>`;
    return;
  }

  const total = (typeof ITEM_META !== 'undefined' && ITEM_META && ITEM_META.total != null)
    ? ITEM_META.total
    : ITEM_DB.length;
  countEl.textContent = total;

  if (ITEM_DB.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${INV_COLS}" class="inv-empty">
      ${q ? 'Gözleg boýunça haryt tapylmady.' : 'Bazada haryt ýok — ýokardaky formadan goşuň.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = ITEM_DB.map((it, i) => {
    return `
    <tr>
      <td class="mono col-idx" data-label="#">${i + 1}</td>
      <td class="mono" data-label="PLU">${invDisp(it.plu)}</td>
      <td class="tl" data-label="Ady"><span class="inv-name">${escapeHtml(it.name || '')}</span></td>
      <td data-label="Kod">${invDisp(it.code)}</td>
      <td class="mono" data-label="Ini (mm)">${invDisp(it.mm, true)}</td>
      <td class="mono" data-label="Gilza (g)">${invDisp(it.tare, true)}</td>
      <td data-label="Amallar">
        <div class="row-actions">
          <button class="btn btn-sm btn-add admin-only" onclick="openWorkOrderFromItem('${it.id}')" title="Work Order">🏭 WO</button>
          <button class="btn btn-sm btn-edit admin-only" onclick="startEditItem('${it.id}')">✎ Üýtget</button>
          <button class="btn btn-sm btn-trash admin-only" onclick="removeItem('${it.id}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

const renderInventoryDebounced = debounce(() => { renderInventory(); }, 280);

async function removeItem(id) {
  const it = findItem(id);
  if (!it) return;
  if (!confirm(`"${it.name}" harydyny bazadan pozmaly my?`)) return;
  try {
    await API.items.remove(it.id);
  } catch (e) {
    alert('Ýalňyşlyk: ' + e.message);
    return;
  }
  if (String(editingItemId) === String(id)) cancelEditItem();
  renderInventory();
}

/* ══════════════════════════════════════════════════════
   BARKOD GÖRKEZME / ÇYKARMA
══════════════════════════════════════════════════════ */
function showBarcode(id) {
  const it = findItem(id);
  if (!it) return;

  const code = (it.barcode || '').replace(/\s/g, '');
  if (!code) {
    alert('Bu harydyň bazada barkody ýok. Excel import arkaly barkod goşuň.');
    return;
  }

  document.getElementById('bc-modal-title').textContent = 'Barkod';
  document.getElementById('bc-label-name').textContent = it.name || '(adsyz)';
  document.getElementById('bc-label-meta').textContent =
    `PLU ${it.plu || '—'}` + (it.code ? ` · Kod ${it.code}` : '') + (it.mm ? ` · ${it.mm}mm` : '');

  renderBarcodeSvg(code);
  document.getElementById('barcode-modal-overlay').classList.add('open');
}

function renderBarcodeSvg(code) {
  const wrap = document.getElementById('bc-svg-wrap');
  const svg = ean13Svg(code);
  wrap.innerHTML = svg || `<div class="bc-fallback">${escapeHtml(code)}</div>`;
}

function closeBarcodeModal() {
  document.getElementById('barcode-modal-overlay').classList.remove('open');
}

/* ══════════════════════════════════════════════════════
   EXCEL EXPORT / IMPORT
══════════════════════════════════════════════════════ */
const EXCEL_HEADERS = [
  'Kod', 'PLU', 'Ady', 'Netto_g', 'Gilza_g', 'Brutto_g', 'Ini_mm',
  'Gornush', 'Self', 'Label', 'Shop', 'Barkod'
];

const EXCEL_BIN_EXT = /\.(xlsx|xlsm|xlsb|xls|ods|fods|uos|sylk|slk|dif|dbf|prn|eth)$/i;
const EXCEL_TEXT_EXT = /\.(csv|txt|tsv)$/i;

function ensureXlsxLib() {
  if (typeof XLSX === 'undefined' || !XLSX.read || !XLSX.utils) {
    throw new Error('Excel okaýjy ýüklenmedi — sahypany täzeläň (Ctrl+F5).');
  }
}

function dateStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function csvCell(val) {
  const s = String(val == null ? '' : val);
  if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildCSV(rows, delim) {
  const d = delim || ';';
  return rows.map(r => (r || []).map(csvCell).join(d)).join('\r\n');
}

function detectDelim(text) {
  const sample = String(text || '').split(/\r?\n/).slice(0, 5).join('\n');
  const counts = {
    ';': (sample.match(/;/g) || []).length,
    ',': (sample.match(/,/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length
  };
  if (counts['\t'] >= counts[';'] && counts['\t'] >= counts[',']) return '\t';
  if (counts[';'] >= counts[',']) return ';';
  return ',';
}

function parseCSV(text, delim) {
  const d = delim || ';';
  const rows = [];
  let row = [];
  let cell = '';
  let inQ = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inQ) {
      if (ch === '"' && next === '"') { cell += '"'; i++; continue; }
      if (ch === '"') { inQ = false; continue; }
      cell += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === d) { row.push(cell); cell = ''; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (ch === '\r') {
      if (next === '\n') continue;
      row.push(cell); rows.push(row); row = []; cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function collectAllItemsForExport() {
  const pageSize = 500;
  let offset = 0;
  let total = Infinity;
  let all = [];
  return (async () => {
    while (offset < total) {
      const res = await API.items.list('', { limit: pageSize, offset });
      const chunk = Array.isArray(res) ? res : (res && res.data) || [];
      const meta = (!Array.isArray(res) && res && res.meta) ? res.meta : null;
      total = meta && meta.total != null ? meta.total : chunk.length;
      all = all.concat(chunk);
      offset += chunk.length;
      if (!chunk.length) break;
    }
    all.sort((a, b) => {
      const ak = String(a.code || '').replace(/\D/g, '');
      const bk = String(b.code || '').replace(/\D/g, '');
      const an = ak ? parseInt(ak, 10) : Number.POSITIVE_INFINITY;
      const bn = bk ? parseInt(bk, 10) : Number.POSITIVE_INFINITY;
      if (an !== bn) return an - bn;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return all;
  })();
}

function exportSheetNum(val) {
  if (val == null || String(val).trim() === '') return '';
  const v = Number(String(val).replace(',', '.'));
  if (!Number.isFinite(v)) return String(val).trim();
  return v;
}

function itemsToSheetRows(all) {
  const rows = [EXCEL_HEADERS.slice()];
  all.forEach(it => {
    const code = String(it.code || '').trim();
    const plu = it.plu || '';
    const name = it.name || '';
    const tare = Number(it.tare) || 0;
    const brutto = Number(it.gram) || 0;
    const netto = Math.max(0, brutto - tare);
    const mm = Number(it.mm) || 0;
    rows.push([
      code,
      plu,
      name,
      exportSheetNum(netto),
      exportSheetNum(tare),
      exportSheetNum(brutto),
      exportSheetNum(mm),
      it.mode || '',
      it.self || '',
      it.label || '',
      it.shop || '',
      String(it.barcode || '').replace(/\s/g, '')
    ]);
  });
  return rows;
}

function writeItemsWorkbook(rows, filename) {
  ensureXlsxLib();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = EXCEL_HEADERS.map((h, i) => ({
    wch: Math.max(10, String(h).length + 2, ...rows.slice(1, 40).map(r => String(r[i] == null ? '' : r[i]).length))
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Harytlar');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  downloadBlob(blob, filename);
}

async function exportItems() {
  let all = [];
  try {
    all = await collectAllItemsForExport();
  } catch (e) {
    alert('Export başartmady: ' + e.message);
    return;
  }
  if (all.length === 0) {
    alert('Bazada haryt ýok — export ediljek zat ýok.');
    return;
  }

  const rows = itemsToSheetRows(all);
  const stamp = dateStamp();

  try {
    writeItemsWorkbook(rows, 'harytlar_' + stamp + '.xlsx');
  } catch (e) {
    const csv = buildCSV(rows, ';');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'harytlar_' + stamp + '.csv');
  }
}

function exportItemsTemplate() {
  const stamp = dateStamp();
  const rows = [EXCEL_HEADERS.slice()];
  try {
    writeItemsWorkbook(rows, 'harytlar_shablon_' + stamp + '.xlsx');
  } catch (e) {
    const csv = buildCSV(rows, ';');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'harytlar_shablon_' + stamp + '.csv');
  }
}

function triggerImport() {
  document.getElementById('import-file').click();
}

function normColHeader(h) {
  return String(h || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[\s./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function findCol(header, names) {
  const norm = header.map(normColHeader);
  for (const n of names) {
    const key = normColHeader(n);
    const i = norm.findIndex(h => h === key);
    if (i >= 0) return i;
  }
  for (const n of names) {
    const key = normColHeader(n);
    const i = norm.findIndex(h => h === key || h.includes(key) || key.includes(h));
    if (i >= 0) return i;
  }
  return -1;
}

function sheetCellText(sheet, r, c) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = sheet[addr];
  if (!cell) return '';
  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    const w = cell.w != null ? String(cell.w).trim() : '';
    if (/^0\d+$/.test(w) && Number(w) === cell.v) return w;
    return String(cell.v);
  }
  if (cell.w != null && String(cell.w).trim() !== '') return String(cell.w).trim();
  if (cell.v != null) return String(cell.v).trim();
  return '';
}

function sheetToRows(sheet) {
  ensureXlsxLib();
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      cells.push(sheetCellText(sheet, r, c));
    }
    rows.push(cells);
  }
  return rows;
}

function readWorkbookFromBuffer(buf) {
  ensureXlsxLib();
  const opts = {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: true,
    raw: false,
    codepage: 65001
  };
  try {
    return XLSX.read(buf, opts);
  } catch (e1) {
    try {
      return XLSX.read(buf, { ...opts, codepage: 1251 });
    } catch (e2) {
      return XLSX.read(buf, { type: 'array' });
    }
  }
}

function handleImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const lower = file.name.toLowerCase();
  const isBin = EXCEL_BIN_EXT.test(lower)
    || /sheet|excel|spreadsheet|ms-excel|opendocument/i.test(file.type || '');
  const isText = EXCEL_TEXT_EXT.test(lower) || /^text\//i.test(file.type || '');

  if (isBin || (!isText && !lower.includes('.'))) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = readWorkbookFromBuffer(new Uint8Array(e.target.result));
        const name = (wb.SheetNames && wb.SheetNames[0]) || '';
        const sheet = name ? wb.Sheets[name] : null;
        if (!sheet) throw new Error('Excel faýlynda list tapylmady.');
        importItemsRows(sheetToRows(sheet));
      } catch (err) {
        alert('Import ýalňyşlygy: ' + (err && err.message ? err.message : err));
      }
      input.value = '';
    };
    reader.onerror = () => {
      alert('Faýl okalmak başartmady.');
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = String(e.target.result || '').replace(/^\uFEFF/, '');
      const delim = detectDelim(text);
      importItemsRows(parseCSV(text, delim));
    } catch (err) {
      alert('Import ýalňyşlygy: ' + (err && err.message ? err.message : err));
    }
    input.value = '';
  };
  reader.onerror = () => {
    alert('Faýl okalmak başartmady.');
    input.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

async function importItemsRows(rows) {
  if (!rows || rows.length < 2) {
    alert('Faýl boş ýa-da diňe başlyk hatary bar.');
    return;
  }

  const header = rows[0].map(h => String(h == null ? '' : h).trim());
  const col = {
    code: findCol(header, ['kod', 'code']),
    plu: findCol(header, ['plu']),
    name: findCol(header, ['ady', 'name', 'ad', 'haryt', 'harydyn_ady', 'naimenovanie']),
    netto: findCol(header, ['netto', 'net', 'netto_g']),
    brutto: findCol(header, ['brutto', 'gross', 'gram', 'agram', 'brutto_g']),
    mm: findCol(header, ['ini', 'width', 'mm', 'ini_mm']),
    tare: findCol(header, ['gilza', 'tara', 'tare', 'gilza_g', 'gilza_kg']),
    mode: findCol(header, ['gornush', 'görnüş', 'mode', 'gorunus']),
    self: findCol(header, ['self']),
    label: findCol(header, ['label']),
    shop: findCol(header, ['shop', 'sklad']),
    barcode: findCol(header, ['barkod', 'barcode'])
  };
  if (col.code < 0) {
    alert('Sütünler tapylmady. Iň bolmanda "Kod" sütuny bolmaly.\n\nTapylan başlyklar: ' + header.join(' | '));
    return;
  }

  const get = (cells, c) => (c >= 0 && cells[c] != null) ? String(cells[c]).trim() : '';

  const cleanCode = (raw) => {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (/^\d+[.,]\d+$/.test(s)) { const n = Number(s.replace(',', '.')); if (Number.isFinite(n) && Math.floor(n) === n) s = String(n); } else if (/^\d+\.?\d*e[+-]?\d+$/i.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) s = String(Math.round(n));
    }
    return s;
  };

  const toNum = (s) => {
    s = String(s || '').trim();
    if (!s) return 0;
    s = s.replace(/\s/g, '').replace(',', '.');
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : 0;
  };

  const payloadRows = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells || cells.join('').trim() === '') continue;
    const code = cleanCode(get(cells, col.code));
    const plu = get(cells, col.plu);
    const nameRaw = col.name >= 0 ? get(cells, col.name) : '';
    if (!code) { skipped += 1; continue; }
    const name = nameRaw || plu || ('Haryt ' + code);

    const tareRaw = col.tare >= 0 ? get(cells, col.tare) : '';
    const nettoRaw = col.netto >= 0 ? get(cells, col.netto) : '';
    const bruttoRaw = col.brutto >= 0 ? get(cells, col.brutto) : '';

    // Faýlda bar sütünler bazada edil Excel-däki ýaly bolýar (boş öýjük → boş/0)
    const tare = tareRaw !== '' ? toNum(tareRaw) : 0;
    const netto = nettoRaw !== '' ? toNum(nettoRaw) : 0;

    const row = { code, name };
    if (col.plu >= 0) row.plu = plu;
    if (col.tare >= 0) row.tare = tare;

    if (nettoRaw !== '') {
      row.netto = netto;
      row.tare = tare;
      row.gram = netto + tare;
    } else if (bruttoRaw !== '') {
      row.gram = toNum(bruttoRaw);
    } else if (col.netto >= 0 || col.brutto >= 0) {
      row.gram = tare;
    }

    if (col.mm >= 0) row.mm = toNum(get(cells, col.mm));
    if (col.mode >= 0) row.mode = get(cells, col.mode);
    if (col.self >= 0) row.self = get(cells, col.self);
    if (col.label >= 0) row.label = get(cells, col.label);
    if (col.shop >= 0) row.shop = get(cells, col.shop);
    if (col.barcode >= 0) row.barcode = get(cells, col.barcode).replace(/\s/g, '');
    payloadRows.push(row);
  }

  if (payloadRows.length === 0) {
    alert('Import ediljek dogry setir tapylmady.');
    return;
  }

  let added = 0, updated = 0, skippedSrv = 0, total = payloadRows.length;
  try {
    const res = await API.items.import(payloadRows);
    added = res ? (res.added || 0) : 0;
    updated = res ? (res.updated || 0) : 0;
    skippedSrv = res ? (res.skipped || 0) : 0;
    total = res && res.total != null ? res.total : total;
  } catch (e) {
    alert('Import ýalňyşlygy: ' + e.message);
    return;
  }

  const searchEl = document.getElementById('inv-search');
  if (searchEl) searchEl.value = '';
  await renderInventory();
  alert(`Import tamamlandy (${total} setir):\n${added} täze haryt goşuldy\n${updated} haryt täzelendi`);
}

function printBarcode() {
  document.body.classList.add('printing-barcode');
  const cleanup = () => {
    document.body.classList.remove('printing-barcode');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

function round3(n) {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}