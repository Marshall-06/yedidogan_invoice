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
  gram: () => document.getElementById('if-gram'),
  tare: () => document.getElementById('if-tare'),
  brutto: () => document.getElementById('if-brutto'),
  mm: () => document.getElementById('if-mm'),
  mode: () => document.getElementById('if-mode'),
  self: () => document.getElementById('if-self'),
  label: () => document.getElementById('if-label'),
  shop: () => document.getElementById('if-shop'),
};

function recalcItemBrutto() {
  const net = parseFloat(IF.gram()?.value) || 0;
  const tare = parseFloat(IF.tare()?.value) || 0;
  const el = IF.brutto();
  if (!el) return;
  const brutto = net + tare;
  el.textContent = brutto > 0 ? String(Math.round(brutto)) : '—';
}

function clearItemForm() {
  Object.values(IF).forEach(get => {
    const el = get();
    if (!el) return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else if (el.id === 'if-brutto') el.textContent = '—';
    else el.value = '';
  });
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

function openNewItem() {
  editingItemId = null;
  clearItemForm();
  setItemFormMode(false);
  navigate('inventory-form');
}

function cancelEditItem() {
  editingItemId = null;
  clearItemForm();
  setItemFormMode(false);
  navigate('inventory');
}

/* Tablisadan "Üýtget" — aýratyn forma sahypasy */
async function startEditItem(id) {
  try {
    await refreshItems('');
  } catch (e) { /* keş boş bolsa */ }
  const it = findItem(id);
  if (!it) {
    alert('Haryt tapylmady');
    return;
  }
  editingItemId = id;
  IF.code().value = it.code || '';
  IF.plu().value = it.plu || '';
  IF.name().value = it.name || '';
  const brutto = +it.gram || 0;
  const tare = Number(it.tare) || 0;
  IF.gram().value = Math.max(0, Math.round(brutto - tare)) || '';
  IF.tare().value = it.tare || '';
  IF.mm().value = it.mm || '';
  if (IF.mode()) IF.mode().value = it.mode || 'Ters';
  IF.self().value = it.self || '';
  IF.label().value = it.label || '';
  IF.shop().value = it.shop || '';
  recalcItemBrutto();
  setItemFormMode(true);
  navigate('inventory-form');
}

/* Forma "goş" ýa-da "ýatda sakla" — barkod awtomatiki döredilmeýär */
async function submitItemForm() {
  const plu = IF.plu().value.trim();
  const name = IF.name().value.trim();
  const netGram = IF.gram().value.trim();
  const mm = IF.mm().value.trim();
  const code = IF.code().value.trim();
  const tare = IF.tare().value.trim();

  if (!name || !code) {
    alert('Harydyň adyny we Kody giriziň!');
    return;
  }

  // Serwere brutto saklaýarys: brutto = netto + tare
  const tareNum = parseFloat(tare) || 0;
  const bruttoGram = Math.max(0, Math.round((parseFloat(netGram) || 0) + tareNum));
  const payload = {
    plu,
    name,
    gram: bruttoGram,
    mm: mm || 0,
    code,
    tare: tare || 0,
    mode: IF.mode()?.value || 'Ters',
    self: IF.self().value.trim(),
    label: IF.label().value.trim(),
    shop: IF.shop().value.trim(),
    barcode: null,
  };

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

const INV_COLS = 13;

function invNetto(it) {
  const brutto = Number(it.gram) || 0;
  const tare = Number(it.tare) || 0;
  const net = Math.max(0, Math.round(brutto - tare));
  return net > 0 ? String(net) : '';
}

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
    await refreshItems(q);
  } catch (e) {
    countEl.textContent = 0;
    tbody.innerHTML = `<tr><td colspan="${INV_COLS}" class="inv-empty">
      Serwere birikip bolmady — backend işleýärmi?<br><small>${escapeHtml(e.message)}</small>
    </td></tr>`;
    return;
  }

  countEl.textContent = ITEM_DB.length;

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
      <td class="mono" data-label="Netto (g)">${escapeHtml(invNetto(it))}</td>
      <td class="mono" data-label="Brutto (g)">${invDisp(it.gram, true)}</td>
      <td class="mono" data-label="Ini (mm)">${invDisp(it.mm, true)}</td>
      <td class="mono" data-label="Gilza (g)">${invDisp(it.tare, true)}</td>
      <td data-label="Mode">${invDisp(it.mode)}</td>
      <td data-label="Self">${invDisp(it.self)}</td>
      <td data-label="Label">${invDisp(it.label)}</td>
      <td data-label="Shop">${invDisp(it.shop)}</td>
      <td data-label="Amallar">
        <div class="row-actions">
          <button class="btn btn-sm btn-edit admin-only" onclick="startEditItem('${it.id}')">✎ Üýtget</button>
          <button class="btn btn-sm btn-trash admin-only" onclick="removeItem('${it.id}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

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
   Bazada saklanan barkody görkezýär.
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

/* Öz EAN-13 SVG çyzgyjymyz — internet/CDN gerek däl */
function renderBarcodeSvg(code) {
  const wrap = document.getElementById('bc-svg-wrap');
  const svg = ean13Svg(code);
  wrap.innerHTML = svg || `<div class="bc-fallback">${escapeHtml(code)}</div>`;
}

function closeBarcodeModal() {
  document.getElementById('barcode-modal-overlay').classList.remove('open');
}

/* ══════════════════════════════════════════════════════
   EXCEL (CSV) EXPORT / IMPORT
   Diňe admin. CSV faýly Excel-de göni açylýar.
══════════════════════════════════════════════════════ */
// Excel üçin durnukly, okamak aňsat tertip (boş meýdanlar hem bolup biler)
const CSV_HEADERS = [
  'Kod', 'PLU', 'Ady', 'Netto_g', 'Gilza_g', 'Brutto_g', 'Ini_mm',
  'Gornush', 'Self', 'Label', 'Shop', 'Barkod'
];

async function exportItems() {
  let all = [];
  try { all = (await API.items.list()) || []; }
  catch (e) { alert('Export başartmady: ' + e.message); return; }
  if (all.length === 0) { alert('Bazada haryt ýok — export ediljek zat ýok.'); return; }
  // Tertiplemek: Kod (san) boýunça, soň ady boýunça
  all.sort((a, b) => {
    const ak = String(a.code || '').replace(/\D/g, '');
    const bk = String(b.code || '').replace(/\D/g, '');
    const an = ak ? parseInt(ak, 10) : Number.POSITIVE_INFINITY;
    const bn = bk ? parseInt(bk, 10) : Number.POSITIVE_INFINITY;
    if (an !== bn) return an - bn;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const rows = [CSV_HEADERS];
  all.forEach(it => {
    const code = String(it.code || '').trim();
    const plu = it.plu || '';
    const name = it.name || '';
    const tare = Math.max(0, Math.round(Number(it.tare) || 0));
    const brutto = Math.max(0, Math.round(+it.gram || 0));
    const netto = Math.max(0, brutto - tare);
    const bc = (it.barcode || '').replace(/\s/g, '');
    rows.push([
      code, plu, name, netto, tare, brutto, it.mm || 0,
      it.mode || '', it.self || '', it.label || '', it.shop || '',
      bc
    ]);
  });
  // Excel (RU/TM lokal) köplenç delimiter hökmünde ";" isleýär
  const csv = buildCSV(rows, ';');
  // BOM — Excel türkmen harplaryny dogry okar ýaly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, 'harytlar_' + dateStamp() + '.csv');
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
  if (cell.w != null && String(cell.w).trim() !== '') return String(cell.w).trim();
  if (cell.v != null) return String(cell.v).trim();
  return '';
}

function sheetToDelimText(sheet) {
  if (typeof XLSX === 'undefined') {
    throw new Error('Excel okaýjy ýüklenmedi — sahypany täzeläň (Ctrl+F5).');
  }
  const ref = sheet['!ref'];
  if (!ref) return '';
  const range = XLSX.utils.decode_range(ref);
  const lines = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      cells.push(csvCell(sheetCellText(sheet, r, c)));
    }
    lines.push(cells.join(';'));
  }
  return lines.join('\r\n');
}

function handleImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) throw new Error('Excel faýlynda list tapylmady.');
        importItemsCSV(sheetToDelimText(sheet));
      } catch (err) {
        alert('Import ýalňyşlygy: ' + err.message);
      }
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try { importItemsCSV(e.target.result); }
    catch (err) { alert('Import ýalňyşlygy: ' + err.message); }
    input.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

async function importItemsCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const delim = detectDelim(text);
  const rows = parseCSV(text, delim);
  if (rows.length < 2) { alert('Faýl boş ýa-da diňe başlyk hatary bar.'); return; }

  const header = rows[0].map(h => String(h).trim());
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
    const code = get(cells, col.code);
    const plu = get(cells, col.plu);
    const nameRaw = col.name >= 0 ? get(cells, col.name) : '';
    if (!code) { skipped += 1; continue; }
    const name = nameRaw || plu || ('Haryt ' + code);

    const tareRaw = col.tare >= 0 ? get(cells, col.tare) : '';
    const nettoRaw = col.netto >= 0 ? get(cells, col.netto) : '';
    const bruttoRaw = col.brutto >= 0 ? get(cells, col.brutto) : '';
    const tare = tareRaw !== '' ? toNum(tareRaw) : 0;
    const netto = nettoRaw !== '' ? toNum(nettoRaw) : 0;
    const brutto = bruttoRaw !== '' ? toNum(bruttoRaw) : 0;

    let bruttoOut = 0;
    if (nettoRaw !== '') bruttoOut = Math.max(0, Math.round(netto + tare));
    else if (bruttoRaw !== '') bruttoOut = Math.max(0, Math.round(brutto));

    const row = { code, name };
    if (plu) row.plu = plu;
    if (bruttoOut > 0) row.gram = bruttoOut;
    else if (bruttoRaw !== '') row.gram = Math.max(0, Math.round(brutto));
    if (col.mm >= 0 && get(cells, col.mm) !== '') row.mm = toNum(get(cells, col.mm));
    if (tareRaw !== '') row.tare = tare;
    if (col.mode >= 0 && get(cells, col.mode) !== '') row.mode = get(cells, col.mode);
    if (col.self >= 0 && get(cells, col.self) !== '') row.self = get(cells, col.self);
    if (col.label >= 0 && get(cells, col.label) !== '') row.label = get(cells, col.label);
    if (col.shop >= 0 && get(cells, col.shop) !== '') row.shop = get(cells, col.shop);
    const bc = col.barcode >= 0 ? get(cells, col.barcode).replace(/\s/g, '') : '';
    if (bc) row.barcode = bc;
    payloadRows.push(row);
  }

  if (payloadRows.length === 0) {
    alert('Import ediljek dogry setir tapylmady.\n\nKod sütuny hökmany. Ady boş bolsa Kod/PLU ulanylýar.'
      + (skipped ? `\n\nKod boş bolan ${skipped} setir geçirildi.` : ''));
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
  await refreshItems('');
  renderInventory();
  const skipNote = (skipped + skippedSrv) ? `\n${skipped + skippedSrv} setir geçirildi.` : '';
  alert(`Import tamamlandy (${total} setir):\n${added} täze haryt goşuldy\n${updated} haryt täzelendi${skipNote}`);
}

/* Etiketkany çap etmek — diňe barkod etiketkasy çykýar */
function printBarcode() {
  document.body.classList.add('printing-barcode');
  const cleanup = () => {
    document.body.classList.remove('printing-barcode');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
