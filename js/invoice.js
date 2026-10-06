'use strict';

/* globals API, escapeHtml, debounce, refreshItems, findItem, findItemByBarcode, findItemByCode, findItemByPlu, lookupItemAsync, parseBC, ITEM_DB, pfStates, refreshInvoicesIndex */

/* ══════════════════════════════════════════════════════
   INVOICE — "Faktura Düzmek" sahypasynyň logikasy
   Setir goşmak, netto/jem hasaplamalar, haryt saýlaýjy
   modal (bazadan), barkod skan we çap formasy.
══════════════════════════════════════════════════════ */

const MODES = ['Ters', 'Göni', 'Ters+Göni', 'Aýlaw', 'Beýleki'];

function round3(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 1000) / 1000;
}
function fmtWeight(n) {
  const x = round3(n);
  if (!x) return '0';
  return String(x);
}

/** Çap — tegeklemesiz (152.508 → 152.508, 153 däl) */
function fmtPrintWeight(grams, unit) {
  const g = round3(grams);
  if (!g) return '0';
  if (unit === 'gr') return String(g);
  // kg: 152.508 g → 0.152508 (3 onluk gram = 6 onluk kg)
  const kg = g / 1000;
  return kg.toFixed(6).replace(/\.?0+$/, '');
}
function fmtPrintWeightHdr(grams, unit) {
  const s = fmtPrintWeight(grams, unit);
  return unit === 'gr' ? s + ' gr.' : s + ' kg';
}

/* Çap grid: 15 sütün × 10 setir = bir fakturanyň doly ýeri */
const INV_GRID_COLS = 15;
const INV_GRID_ROWS = 10;
const INV_MAX_BLOCKS = INV_GRID_COLS * INV_GRID_ROWS;

let rid = 0;
const rows = new Map();
let currentInvoiceId = null;
let _invoiceListCache = [];

function setCurrentInvoice(id) {
  currentInvoiceId = id != null ? Number(id) : null;
}

function countFilledInvoiceRows() {
  return getItemsFromRows().length;
}

function suggestNextFakturaNo() {
  let max = 0;
  for (const inv of _invoiceListCache) {
    const d = String(inv.fakturaNo || '').replace(/\D/g, '');
    if (!d) continue;
    const n = parseInt(d, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

/* Haryt goşulanda faktura adyna / № awto doldur */
function syncInvoiceProductMeta(productOrName) {
  const name = typeof productOrName === 'string'
    ? productOrName.trim()
    : String((productOrName && productOrName.name) || '').trim();
  if (!name) return;

  const zawodEl = document.getElementById('f-zawod');
  const orgEl = document.getElementById('org-display');
  if (zawodEl) zawodEl.value = name;
  if (orgEl) orgEl.textContent = name;

  const numEl = document.getElementById('f-num');
  const stamp = document.getElementById('stamp-num');
  if (numEl && !String(numEl.value || '').trim()) {
    const next = suggestNextFakturaNo();
    numEl.value = next;
    if (stamp) stamp.textContent = next;
  }
}

function incrementFakturaNo(prev) {
  const d = String(prev || '').replace(/\D/g, '');
  if (!d) return suggestNextFakturaNo();
  return String(parseInt(d, 10) + 1);
}

/** Faktura API — baza ýalňyşlygynda awtomat repair synag */
async function postInvoiceToApi(data, isEdit) {
  const doSave = async () => {
    if (isEdit) {
      try {
        return await API.invoices.update(currentInvoiceId, data);
      } catch (e) {
        if (e && e.status === 404) return await API.invoices.patch(currentInvoiceId, data);
        throw e;
      }
    }
    const saved = await API.invoices.create(data);
    if (saved && saved.id) setCurrentInvoice(saved.id);
    return saved;
  };

  try {
    return await doSave();
  } catch (e) {
    if (typeof isDbRepairableError === 'function' && isDbRepairableError(e) && API.repairDb) {
      try {
        await API.repairDb();
        return await doSave();
      } catch (repairErr) {
        throw e;
      }
    }
    throw e;
  }
}

function showInvoiceSaveError(e) {
  const extra = e && e.details && e.details.length ? '\n' + e.details.join('\n') : '';
  alert('Ýalňyşlyk: ' + (e && e.message ? e.message : String(e)) + extra);
}

async function saveInvoiceSilent() {
  const items = [];
  [...document.querySelectorAll('#tbody tr')].reverse().forEach(tr => {
    const id = parseInt(tr.dataset.id, 10);
    syncRowFromDom(id);
    const r = rows.get(id); if (!r) return;
    const hasCode = r.code && String(r.code).trim();
    const hasName = r.name && String(r.name).trim();
    if (!hasCode && !hasName) return;
    items.push({
      plu: (r.plu != null && String(r.plu).trim() !== '' && String(r.plu).trim() !== '0')
        ? String(r.plu).trim()
        : null,
      name: r.name,
      code: r.code,
      width: String(r.width || ''),
      mode: r.mode,
      gross: r.gross,
      tare: r.tare,
      net: r.net,
      self: r.self,
      label: r.label,
      shop: r.shop,
      boxQty: r.box_qty
    });
  });
  if (items.length === 0) throw new Error('Saklanjak setir ýok');

  const data = {
    fakturaNo: document.getElementById('f-num').value,
    zawod: document.getElementById('f-zawod').value,
    sklad: document.getElementById('f-sklad').value,
    date: document.getElementById('f-date').value,
    issued: document.getElementById('f-issued').value,
    received: document.getElementById('f-recv').value,
    items
  };

  let saved;
  if (currentInvoiceId) {
    saved = await postInvoiceToApi(data, true);
  } else {
    saved = await postInvoiceToApi(data, false);
  }
  if (typeof refreshInvoicesIndex === 'function') refreshInvoicesIndex().catch(() => { });
  return saved;
}

/* 150 ýer dolanda: alert → sakla → täze faktura (şol haryt ady bilen) */
async function rollOverFullInvoice() {
  const productName = (document.getElementById('f-zawod')?.value || '').trim();
  const prevNo = (document.getElementById('f-num')?.value || '').trim();

  alert(
    `Faktura doldy!\n` +
    `${INV_GRID_ROWS} setir × ${INV_GRID_COLS} sütün = ${INV_MAX_BLOCKS} ýer.\n` +
    `Saklanýar we täze faktura açylýar.`
  );

  try {
    await saveInvoiceSilent();
  } catch (e) {
    alert('Fakturany saklap bolmady: ' + e.message);
    return false;
  }

  newInvoice();
  if (productName) {
    const zawodEl = document.getElementById('f-zawod');
    const orgEl = document.getElementById('org-display');
    if (zawodEl) zawodEl.value = productName;
    if (orgEl) orgEl.textContent = productName;
  }
  const nextNo = incrementFakturaNo(prevNo);
  const numEl = document.getElementById('f-num');
  const stamp = document.getElementById('stamp-num');
  if (numEl) numEl.value = nextNo;
  if (stamp) stamp.textContent = nextNo;
  focusBarcodeInput();
  return true;
}

async function ensureInvoiceCapacityForNewRow() {
  if (countFilledInvoiceRows() < INV_MAX_BLOCKS) return true;
  return rollOverFullInvoice();
}

async function checkInvoiceFullAfterAdd() {
  if (countFilledInvoiceRows() < INV_MAX_BLOCKS) return;
  await rollOverFullInvoice();
}

function resetInvoiceFormMeta() {
  document.getElementById('f-num').value = '';
  document.getElementById('f-zawod').value = '';
  document.getElementById('f-sklad').value = '';
  document.getElementById('f-issued').value = '';
  document.getElementById('f-recv').value = '';
  document.getElementById('stamp-num').textContent = '—';
  document.getElementById('org-display').textContent = 'Haryt ady';
}

function resetInvoiceRows() {
  document.getElementById('tbody').innerHTML = '';
  document.getElementById('tfoot').innerHTML = '';
  rows.clear();
  rid = 0;
}

function setInvoiceEditorVisible(on) {
  const editor = document.getElementById('invoice');
  const actions = document.getElementById('inv-editor-actions');
  const indexCard = document.querySelector('.inv-index-card');
  const backBtn = document.getElementById('inv-back-list');
  if (editor) editor.style.display = on ? '' : 'none';
  if (actions) actions.style.display = on ? 'flex' : 'none';
  if (indexCard) indexCard.style.display = on ? 'none' : '';
  if (backBtn) backBtn.style.display = on ? '' : 'none';
  if (on) focusBarcodeInput();
}

/* Faktura açylanda barkod skan meýdanyna fokus — myszka basmazdan skan */
function focusBarcodeInput() {
  const inp = document.getElementById('bc-in');
  if (!inp) return;
  const editor = document.getElementById('invoice');
  if (editor && editor.style.display === 'none') return;
  setTimeout(() => {
    try {
      inp.focus({ preventScroll: true });
      inp.select();
    } catch (e) {
      try { inp.focus(); } catch (_) { /* ignore */ }
    }
  }, 30);
}

function isInvoiceScanReady() {
  const editor = document.getElementById('invoice');
  if (!editor || editor.style.display === 'none') return false;
  const preview = document.getElementById('print-preview');
  if (preview && preview.classList.contains('open')) return false;
  if (document.querySelector('.modal-overlay.open')) return false;
  return true;
}

/** Skanerden gelen setiri arassala (prefix/suffix, boşluk, Enter galyndysy) */
function cleanScannerCode(raw) {
  let s = String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, '')
    .trim();
  s = s.replace(/^\][A-Za-z0-9]{0,2}/, '');
  const digits = s.match(/\d{6,}/g);
  if (digits && digits.length) {
    digits.sort((a, b) => b.length - a.length);
    return digits[0];
  }
  return s;
}

function showInvoiceList() {
  closePrintPreview();
  setInvoiceEditorVisible(false);
  if (typeof refreshInvoicesIndex === 'function') refreshInvoicesIndex().catch(() => { });
}

function parseBoxQty(val, fallback = 2) {
  const n = parseInt(String(val ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function syncPrintPerBlockFromRows() {
  return;
}

function getPrintPerBlock() {
  const pbEl = document.getElementById('print-perblock');
  return parseBoxQty(pbEl?.value);
}

function applyPrintPerBlockToRows(qty) {
  document.querySelectorAll('#tbody tr').forEach(tr => {
    const id = parseInt(tr.dataset.id, 10);
    const r = rows.get(id);
    if (!r) return;
    r.box_qty = qty;
    const bqtyEl = document.getElementById('bqty-' + id);
    if (bqtyEl) bqtyEl.value = qty;
  });
  refreshPfBoxQtysFromRows();
}

function onPrintPerBlockApply() {
  const pbEl = document.getElementById('print-perblock');
  if (!pbEl) return;

  const qty = parseBoxQty(pbEl.value, 2);
  pbEl.value = qty;

  rows.forEach((r, id) => {
    r.box_qty = qty;
    const bqtyEl = document.getElementById('bqty-' + id);
    if (bqtyEl) bqtyEl.value = qty;
  });

  refreshPfBoxQtysFromRows();
}

function onRowBoxQtyChange(id, el) {
  const qty = parseBoxQty(el.value);
  el.value = qty;
  const r = rows.get(id);
  if (r) r.box_qty = qty;
  syncPrintPerBlockFromRows();
  refreshPfBoxQtysFromRows();
}

/** printOrder=true → çap / skan tertibi (aşakdan ýokary = ilkinji skan öňde) */
function getItemsFromRows(printOrder = false) {
  const trs = [...document.querySelectorAll('#tbody tr')];
  if (printOrder) trs.reverse();
  const items = [];
  trs.forEach(tr => {
    const id = parseInt(tr.dataset.id, 10);
    syncRowFromDom(id);
    const r = rows.get(id);
    if (!r || (!r.code && !r.name)) return;
    items.push({ ...r, _rowId: id });
  });
  return items;
}

/* Bir çek = bir haryt (kod ýa-da at) */
function productKey(code, name) {
  return String(code || name || '').trim();
}

function getExistingInvoiceProductKey() {
  for (const item of getItemsFromRows()) {
    const key = productKey(item.code, item.name);
    if (key) return key;
  }
  return '';
}

function assertSameInvoiceProduct(code, name) {
  const existing = getExistingInvoiceProductKey();
  if (!existing) return true;
  const next = productKey(code, name);
  if (!next) return true;
  if (existing !== next) {
    alert('Sen ýalňyş çykardyň — bir çekde diňe bir haryt bolmaly!');
    return false;
  }
  return true;
}

function refreshPfBoxQtysFromRows() {
  if (!pfStates || !pfStates.length) return;
  const items = getItemsFromRows(true);
  let idx = 0;
  for (const st of pfStates) {
    for (let i = 0; i < st.boxQtys.length; i++) {
      st.boxQtys[i] = parseBoxQty(items[idx]?.box_qty, getPrintPerBlock());
      idx++;
    }
    const meta = buildSaryMetaFromBlocks(st.boxQtys, st.COLS, st.ROWS, getPrintPerBlock());
    st.saryQtys = meta.saryQtys;
    st.saryMixed = meta.saryMixed;
    st.saryColSums = meta.saryColSums;
    st.bqty = calcPageRulonTotal(st);
  }
  renderPfValues();
}

/* Jemi rulon = her setiriň öz box_qty jemi (3+3+3+3+1 = 13) */
function calcPageRulonTotal(st) {
  const fallback = getPrintPerBlock();
  if (Array.isArray(st.boxQtys) && st.boxQtys.length) {
    return st.boxQtys.reduce((s, q) => s + parseBoxQty(q, fallback), 0);
  }
  const { COLS, ROWS, blocks } = st;
  const sq = st.saryQtys || Array(COLS).fill(fallback);
  let placed = 0;
  let total = 0;
  outer:
  for (let ci = 0; ci < COLS; ci++) {
    for (let ri = 0; ri < ROWS; ri++) {
      if (placed >= blocks) break outer;
      total += parseBoxQty(sq[ci], fallback);
      placed++;
    }
  }
  return total;
}

/**
 * Sütün meta: hemmesi deň bolsa sary = şol san;
 * dürli bolsa (mysal 3,3,3,3,1) — mixed, görkezmede sütün jemi.
 */
function buildSaryMetaFromBlocks(boxQtys, COLS, ROWS, fallback) {
  const fb = parseBoxQty(fallback, 2);
  const saryQtys = Array(COLS).fill(fb);
  const saryMixed = Array(COLS).fill(false);
  const saryColSums = Array(COLS).fill(0);
  let placed = 0;
  for (let ci = 0; ci < COLS; ci++) {
    if (placed >= boxQtys.length) break;
    const qs = [];
    for (let ri = 0; ri < ROWS && placed < boxQtys.length; ri++) {
      qs.push(parseBoxQty(boxQtys[placed], fb));
      placed++;
    }
    const sum = qs.reduce((a, b) => a + b, 0);
    const allSame = qs.length > 0 && qs.every(q => q === qs[0]);
    saryColSums[ci] = sum;
    saryMixed[ci] = !allSame;
    saryQtys[ci] = allSame ? qs[0] : sum;
  }
  return { saryQtys, saryMixed, saryColSums };
}

function buildSaryQtysFromBlocks(boxQtys, COLS, ROWS, fallback) {
  return buildSaryMetaFromBlocks(boxQtys, COLS, ROWS, fallback).saryQtys;
}

/** Çapdaky box_qty üýtgese — faktura tablisasyndaky Gapdaky haryt hem sinhron */
function syncInvoiceBoxQtysFromPrintState(st) {
  if (!st || !Array.isArray(st.boxQtys)) return;
  const items = getItemsFromRows(true);
  const start = (st._itemOffset != null) ? st._itemOffset : 0;
  for (let i = 0; i < st.boxQtys.length; i++) {
    const item = items[start + i];
    if (!item || item._rowId == null) continue;
    const qty = parseBoxQty(st.boxQtys[i], getPrintPerBlock());
    const r = rows.get(item._rowId);
    if (r) r.box_qty = qty;
    const el = document.getElementById('bqty-' + item._rowId);
    if (el) el.value = qty;
  }
}

function updatePfRulonTotals(pi) {
  const st = pfStates[pi];
  if (!st) return;
  st.bqty = calcPageRulonTotal(st);
  const pageEl = document.querySelector(`.pf-page[data-pi="${pi}"]`);
  if (!pageEl) return;
  const t = String(st.bqty);
  pageEl.querySelectorAll('.pf-rulon-total').forEach(e => { e.textContent = t; });
  pageEl.querySelectorAll('.pf-rulon').forEach(e => { e.textContent = t; });
}

function syncSaryQtysFromPreview() {
  document.querySelectorAll('.pf-sary-in').forEach(inp => {
    const pi = parseInt(inp.dataset.pi, 10);
    const col = parseInt(inp.dataset.col, 10);
    const st = pfStates[pi];
    if (!st) return;
    if (!st.saryQtys) st.saryQtys = Array(st.COLS).fill(getPrintPerBlock());
    st.saryQtys[col] = parseBoxQty(inp.value, getPrintPerBlock());
    inp.setAttribute('value', inp.value);
  });
}

function newInvoice() {
  closePrintPreview();
  setCurrentInvoice(null);
  resetInvoiceFormMeta();
  resetInvoiceRows();
  setInvoiceEditorVisible(true);
  if (typeof refreshItems === 'function') refreshItems('', { limit: 100, offset: 0 }).catch(() => { });
}

/* ══ INIT ════════════════════════════════════════════════ */
(function () {
  const t = new Date();
  document.getElementById('f-date').value = t.toISOString().split('T')[0];
  document.getElementById('foot-date').textContent =
    t.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  document.getElementById('f-date').addEventListener('change', function () {
    const d = new Date(this.value + 'T12:00:00');
    document.getElementById('foot-date').textContent =
      d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  });
})();

/* ══ ITEM PICKER MODAL (faktura + Work Order) ══ */
let itemPickerTarget = 'invoice'; // 'invoice' | 'production'

async function openItemPickerFor(target) {
  itemPickerTarget = target === 'production' ? 'production' : 'invoice';
  const title = document.getElementById('item-modal-title');
  if (title) {
    title.textContent = itemPickerTarget === 'production'
      ? 'Work Order — bazadan önüm saýla'
      : 'Bazadan haryt saýla';
  }
  document.getElementById('item-modal-overlay').classList.add('open');
  document.getElementById('item-search').value = '';
  const list = document.getElementById('item-list');
  list.innerHTML = `<div class="item-empty">Ýüklenýär…</div>`;
  await renderItemList();
  setTimeout(() => document.getElementById('item-search').focus(), 50);
}

async function openItemPicker() {
  await openItemPickerFor('invoice');
}

function closeItemPicker() {
  document.getElementById('item-modal-overlay').classList.remove('open');
  if (itemPickerTarget === 'production') {
    setTimeout(() => {
      const el = document.getElementById('po-musteri') || document.getElementById('po-product-code');
      if (el) el.focus();
    }, 40);
    return;
  }
  const editor = document.getElementById('invoice');
  if (editor && editor.style.display !== 'none') focusBarcodeInput();
}

async function renderItemList() {
  const q = (document.getElementById('item-search').value || '').trim();
  const list = document.getElementById('item-list');
  if (!list) return;

  try {
    await refreshItems(q, { limit: 80, offset: 0 });
  } catch (e) {
    list.innerHTML = `<div class="item-empty">Ýalňyşlyk: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const filtered = ITEM_DB;
  if (filtered.length === 0) {
    list.innerHTML = `<div class="item-empty">${q ? 'Tapylmady.' : 'Haryt tapylmady — "Harytlar Bazasy" sahypasyndan goşuň.'}</div>`;
    return;
  }

  list.innerHTML = filtered.map(it => `
    <div class="item-card" onclick="pickItem('${it.id}')">
      <div class="ic-info">
        <div class="ic-name">${escapeHtml(it.name || '(adsyz)')}</div>
        <div class="ic-meta">Kod ${escapeHtml(String(it.code ?? '—'))} · PLU ${escapeHtml(String(it.plu ?? '—'))} · ${+it.gram || 0}g · ${it.mm || 0}mm · ${escapeHtml(it.barcode || 'barkodsuz')}</div>
      </div>
      <button class="ic-pick" onclick="event.stopPropagation();pickItem('${it.id}')">Saýla</button>
    </div>
  `).join('');
}

const renderItemListDebounced = debounce(() => { renderItemList(); }, 280);

async function pickItem(id) {
  const it = findItem(id);
  if (!it) return;

  if (itemPickerTarget === 'production') {
    if (typeof applyItemToWorkOrder === 'function') {
      applyItemToWorkOrder(it);
    }
    closeItemPicker();
    return;
  }

  if (!assertSameInvoiceProduct(it.code, it.name)) return;
  await ensureInvoiceCapacityForNewRow();
  const tare = round3(parseFloat(it.tare) || 0);
  const brutto = round3(+it.gram || 0);
  // Brutto = netto + tare. Bazada gram brutto bolsa net = gram - tare.
  const net = brutto > 0 ? Math.max(0, round3(brutto - tare)) : 0;
  addRow({
    plu: it.plu != null ? String(it.plu) : '',
    name: it.name,
    code: it.code || '',
    width: it.mm,
    tare,
    net,
    mode: it.mode || '',
    self: it.self || '',
    label: it.label || '',
    shop: it.shop || '',
    box_qty: getPrintPerBlock()
  });
  syncInvoiceProductMeta(it);
  closeItemPicker();
  await checkInvoiceFullAfterAdd();
}

/* ══ ADD ROW ═════════════════════════════════════════════ */
function addRow(p) {
  const id = ++rid;
  const tare = round3(parseFloat(p?.tare) || 0);
  const grossIn = round3(parseFloat(p?.gross) || 0);
  const net = p?.net != null ? round3(parseFloat(p.net) || 0) : Math.max(0, round3(grossIn - tare));

  const currentBoxQty = getPrintPerBlock();

  rows.set(id, {
    plu: p?.plu || '',
    name: p?.name || '',
    code: p?.code || '',
    width: p?.width || '',
    mode: p?.mode || '',
    net,
    tare,
    gross: round3(net + tare),
    self: p?.self || '',
    label: p?.label || '',
    shop: p?.shop || '',
    box_qty: p?.box_qty || currentBoxQty
  });
  const tb = document.getElementById('tbody');
  const tr = document.createElement('tr');
  tr.id = 'row-' + id; tr.dataset.id = id;
  tr.innerHTML = rowHTML(id, 1, rows.get(id));
  if (tb.firstChild) tb.insertBefore(tr, tb.firstChild);
  else tb.appendChild(tr);
  renumber();
  recalc(id);
  return id;
}

function rowHTML(id, n, p) {
  const r = p || {};
  const tare = round3(parseFloat(r.tare) || 0);
  const gross = round3(parseFloat(r.gross) || 0);
  const net = r.net != null ? round3(parseFloat(r.net) || 0) : Math.max(0, round3(gross - tare));
  const brutto = round3(net + tare);
  return `
  <td class="rn" id="rn-${id}">${n}</td>
  <td><input class="ci w-code" id="code-${id}" value="${r.code || ''}" placeholder="S22"
        oninput="setf(${id},'code',this.value)"/></td>
  <td><input class="ci w-plu mn" id="plu-${id}" value="${r.plu || ''}" placeholder="21025"
        oninput="setf(${id},'plu',this.value)"/></td>
  <td class="tl"><input class="ci tl w-name" id="name-${id}" value="${r.name || ''}" placeholder="Harydyň ady…"
        oninput="setf(${id},'name',this.value)"/></td>
  <td><input class="ci w-med mn" type="number" min="0" step="any" id="net-${id}"
        value="${net > 0 ? fmtWeight(net) : ''}" placeholder="0"
        oninput="onNetto(${id},this.value)"/></td>
  <td><span class="cc" id="gross-${id}">${brutto > 0 ? fg(brutto) : '—'}</span></td>
  <td><input class="ci w-num mn" type="number" min="1" step="1" id="bqty-${id}"
        value="${parseBoxQty(r.box_qty, getPrintPerBlock())}" placeholder="1"
        onchange="onRowBoxQtyChange(${id},this)" onblur="onRowBoxQtyChange(${id},this)"/></td>
  <td><button class="btn-del" onclick="delRow(${id})" title="Poz">✕</button></td>`;
}

/* ══ HANDLERS ════════════════════════════════════════════ */
function applyTareFromItem(id) {
  const r = rows.get(id);
  if (!r) return;
  let it = null;
  if (r.code && typeof findItemByCode === 'function') it = findItemByCode(r.code);
  if (!it && r.plu && typeof findItemByPlu === 'function') it = findItemByPlu(r.plu);
  if (it && it.tare != null && it.tare !== '') {
    r.tare = round3(parseFloat(it.tare) || 0);
    recalc(id);
  }
}

function setf(id, f, v) {
  const r = rows.get(id);
  if (r) r[f] = v;
  if (f === 'code' || f === 'plu') applyTareFromItem(id);
}

function onNetto(id, v) {
  const r = rows.get(id); if (!r) return;
  r.net = round3(parseFloat(String(v).replace(',', '.')) || 0);
  if (!r.tare && (r.code || r.plu)) applyTareFromItem(id);
  recalc(id);
}

/* DOM-daky görünýän meýdanlary rows Map-e sinhronlaýar */
function syncRowFromDom(id) {
  const r = rows.get(id); if (!r) return;
  const el = (suffix) => document.getElementById(suffix + '-' + id);
  if (el('code')) r.code = el('code').value;
  if (el('plu')) r.plu = el('plu').value;
  if (el('name')) r.name = el('name').value;
  if (el('bqty')) r.box_qty = parseBoxQty(el('bqty').value);
  r.net = round3(parseFloat(String(el('net')?.value || '').replace(',', '.')) || 0);
  r.gross = round3((parseFloat(r.net) || 0) + (parseFloat(r.tare) || 0));
}

/* ══ RECALC: Brutto = Netto + Gilza(Tare) ══ */
function recalc(id) {
  const r = rows.get(id); if (!r) return;
  r.net = round3(parseFloat(r.net) || 0);
  r.tare = round3(parseFloat(r.tare) || 0);
  r.gross = round3(r.net + r.tare);
  const el = document.getElementById('gross-' + id);
  if (el) el.textContent = r.gross > 0 ? fmtWeight(r.gross) : '—';
  totals();
}
/* Agram — 3 onluk (0.598 saklanýar) */
function fg(n) { return fmtWeight(n); }

/* ══ TOTALS ══════════════════════════════════════════════ */
function totals() {
  let sg = 0, sn = 0;
  document.querySelectorAll('#tbody tr').forEach(tr => {
    const id = parseInt(tr.dataset.id);
    syncRowFromDom(id);
    const r = rows.get(id); if (!r) return;
    sg += r.gross;
    sn += r.net;
  });
  document.getElementById('tfoot').innerHTML = `
    <tr class="tf">
      <td colspan="4"></td>
      <td class="tfl">Netto:</td>
      <td class="tfv">${fg(sn)} g</td>
      <td class="tfl">Brutto:</td>
      <td class="tfv">${fg(sg)} g</td>
      <td colspan="2"></td>
    </tr>`;
}

/* ══ DELETE / RENUMBER ═══════════════════════════════════ */
function delRow(id) {
  const tr = document.getElementById('row-' + id);
  if (tr) tr.remove();
  rows.delete(id);
  renumber(); totals();
}
function renumber() {
  const trs = document.querySelectorAll('#tbody tr');
  const total = trs.length;
  trs.forEach((tr, i) => {
    const el = document.getElementById('rn-' + tr.dataset.id);
    if (el) el.textContent = total - i;
  });
}

/* ══ CLEAR ALL ═══════════════════════════════════════════ */
function clearAll() {
  if (!confirm('Ähli setirleri pozmak isleýärsiňizmi?')) return;
  document.getElementById('tbody').innerHTML = '';
  document.getElementById('tfoot').innerHTML = '';
  rows.clear(); rid = 0;
}

/* ══ SAVE ════════════════════════════════════════════════ */
async function saveInvoice() {
  const items = [];
  [...document.querySelectorAll('#tbody tr')].reverse().forEach(tr => {
    const id = parseInt(tr.dataset.id);
    syncRowFromDom(id);
    const r = rows.get(id); if (!r) return;
    const hasCode = r.code && String(r.code).trim();
    const hasName = r.name && String(r.name).trim();
    if (!hasCode && !hasName) return;
    items.push({
      plu: (r.plu != null && String(r.plu).trim() !== '' && String(r.plu).trim() !== '0')
        ? String(r.plu).trim()
        : null,
      name: r.name,
      code: r.code,
      width: String(r.width || ''),
      mode: r.mode,
      gross: r.gross,
      tare: r.tare,
      net: r.net,
      self: r.self,
      label: r.label,
      shop: r.shop,
      boxQty: r.box_qty
    });
  });

  if (items.length === 0) { alert('Iň bolmanda bir haryt setiri giriziň!'); return; }

  const data = {
    fakturaNo: document.getElementById('f-num').value,
    zawod: document.getElementById('f-zawod').value,
    sklad: document.getElementById('f-sklad').value,
    date: document.getElementById('f-date').value,
    issued: document.getElementById('f-issued').value,
    received: document.getElementById('f-recv').value,
    items
  };

  const b = document.querySelector('.btn-inv-save') || document.querySelector('.btn-save');
  const o = b ? b.innerHTML : '';
  const isEdit = !!currentInvoiceId;
  try {
    const saved = await postInvoiceToApi(data, isEdit);
    if (b) {
      b.innerHTML = isEdit ? '✓ Täzelendi' : '✓ Saklandy';
      b.style.cssText = 'background:#1e6b45;color:#fff';
      setTimeout(() => { b.innerHTML = o; b.style.cssText = '' }, 1800);
    }
    if (typeof refreshInvoicesIndex === 'function') refreshInvoicesIndex().catch(() => { });
  } catch (e) {
    showInvoiceSaveError(e);
  }
}

async function loadInvoice(id) {
  let inv;
  try { inv = await API.invoices.get(id); }
  catch (e) { alert('Ýalňyşlyk: ' + e.message); return; }
  if (!inv) return;

  if (typeof refreshItems === 'function') {
    try { await refreshItems('', { limit: 100, offset: 0 }); } catch (e) { /* skan üçin keş täzelenmegi gerek däl */ }
  }

  setCurrentInvoice(inv.id);
  closePrintPreview();
  setInvoiceEditorVisible(true);

  document.getElementById('f-num').value = inv.fakturaNo || '';
  document.getElementById('stamp-num').textContent = inv.fakturaNo || '—';
  document.getElementById('f-zawod').value = inv.zawod || '';
  document.getElementById('org-display').textContent = inv.zawod || 'Haryt ady';
  document.getElementById('f-sklad').value = inv.sklad || '';
  document.getElementById('f-date').value = inv.date || '';
  document.getElementById('f-issued').value = inv.issued || '';
  document.getElementById('f-recv').value = inv.received || '';

  const d = inv.date ? new Date(inv.date + 'T12:00:00') : new Date();
  document.getElementById('foot-date').textContent =
    d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  document.getElementById('tbody').innerHTML = '';
  document.getElementById('tfoot').innerHTML = '';
  rows.clear(); rid = 0;

  (inv.items || []).forEach(it => {
    const gross = round3(parseFloat(it.gross) || 0);
    const tare = round3(parseFloat(it.tare) || 0);
    const net = it.net != null ? round3(parseFloat(it.net) || 0) : Math.max(0, round3(gross - tare));
    addRow({
      plu: it.plu != null ? String(it.plu) : '',
      name: it.name || '',
      code: it.code || '',
      width: it.width || '',
      mode: it.mode || '',
      net,
      tare,
      gross: round3(net + tare),
      self: it.self || '',
      label: it.label || '',
      shop: it.shop || '',
      box_qty: it.boxQty || it.box_qty || 2
    });
  });
  totals();
  syncPrintPerBlockFromRows();
}

async function deleteInvoice(id) {
  if (!confirm('Fakturany pozmaly my?')) return;
  try { await API.invoices.remove(id); }
  catch (e) { alert('Ýalňyşlyk: ' + e.message); return; }
  if (currentInvoiceId && Number(currentInvoiceId) === Number(id)) {
    newInvoice();
  }
  if (typeof refreshInvoicesIndex === 'function') refreshInvoicesIndex().catch(() => { });
}

async function refreshInvoicesIndex() {
  const wrap = document.getElementById('inv-index-list');
  if (!wrap) return;
  wrap.innerHTML = `<div class="inv-empty">Ýüklenýär…</div>`;
  let list = [];
  try { list = (await API.invoices.list({ limit: 50, offset: 0 })) || []; }
  catch (e) { wrap.innerHTML = `<div class="inv-empty">Ýalňyşlyk: ${escapeHtml(e.message)}</div>`; return; }
  _invoiceListCache = list;
  if (list.length === 0) {
    wrap.innerHTML = `<div class="inv-empty">Faktura ýok.</div>`;
    return;
  }
  wrap.innerHTML = list.slice(0, 50).map(inv => {
    const itCount = inv.itemCount != null
      ? Number(inv.itemCount)
      : (Array.isArray(inv.items) ? inv.items.length : 0);
    const productName = inv.productName
      || (inv.items && inv.items[0] && inv.items[0].name)
      || inv.zawod
      || '';
    const title = `#${inv.id}`
      + (inv.fakturaNo ? ` · № ${escapeHtml(inv.fakturaNo)}` : '')
      + (productName ? ` · ${escapeHtml(productName)}` : '');
    const sub = `${inv.date || '—'} · setir: ${itCount}`
      + (itCount >= INV_MAX_BLOCKS ? ' · DOLY' : '')
      + (inv.sklad ? ` · ${escapeHtml(inv.sklad)}` : '');
    return `
      <div class="inv-index-item">
        <div class="inv-index-meta">
          <div class="inv-index-title">${title}${currentInvoiceId === inv.id ? ' (açyk)' : ''}</div>
          <div class="inv-index-sub">${sub}</div>
        </div>
        <div class="inv-index-actions">
          <button class="btn btn-sm btn-edit" onclick="loadInvoice('${inv.id}')">Aç</button>
          <button class="btn btn-sm btn-trash" onclick="deleteInvoice('${inv.id}')">Poz</button>
        </div>
      </div>`;
  }).join('');
}

/* ══ BARCODE SKAN — USB / Bluetooth klawiatura-wedge skanerler ══
   Skaner çalt harplary + Enter/Tab iberýär. Fokus başga ýerde bolsa-da
   çalt giriziş tanalýar we faktura setirine goşulýar.
══════════════════════════════════════════════════════ */
(function () {
  const inp = document.getElementById('bc-in');
  const flash = document.getElementById('bc-flash');
  const chips = document.getElementById('bc-chips');
  if (!inp) return;

  const SCAN_GAP_MS = 50;
  const SCAN_IDLE_MS = 140;
  const SCAN_MIN_LEN = 6;

  let scanBuf = '';
  let lastKeyTs = 0;
  let idleTimer = null;
  let applyBusy = false;
  let burstMode = false; // çalt skaner girizişi

  function showFlash(msg, type) {
    if (!flash) return;
    flash.textContent = msg;
    flash.className = 'bc-flash ' + type;
    clearTimeout(flash._t);
    flash._t = setTimeout(() => { flash.className = 'bc-flash'; }, 2400);
  }

  function emptyRowForScan() {
    for (const tr of document.querySelectorAll('#tbody tr')) {
      const id = parseInt(tr.dataset.id);
      const pluEl = document.getElementById('plu-' + id);
      const codeEl = document.getElementById('code-' + id);
      const pluEmpty = !pluEl || !pluEl.value.trim();
      const codeEmpty = !codeEl || !codeEl.value.trim();
      if (pluEmpty && codeEmpty) return id;
    }
    return null;
  }

  function fillRow(tid, res, product) {
    const r = rows.get(tid); if (!r) return;

    const pluEl = document.getElementById('plu-' + tid);
    if (pluEl && product && product.plu != null && String(product.plu).trim() !== '') {
      pluEl.value = String(product.plu).trim();
      r.plu = String(product.plu).trim();
    } else if (pluEl) {
      pluEl.value = '';
      r.plu = '';
    }

    const codeEl2 = document.getElementById('code-' + tid);
    if (codeEl2 && res.code) { codeEl2.value = res.code; r.code = res.code; }

    if (product) {
      const nameEl = document.getElementById('name-' + tid);
      if (nameEl && product.name) { nameEl.value = product.name; r.name = product.name; }
      if (codeEl2 && product.code) { codeEl2.value = product.code; r.code = product.code; }
      if (product.mm != null && product.mm !== '') r.width = String(product.mm);
      if (product.tare != null && product.tare !== '') r.tare = round3(+product.tare);
      if (product.mode) r.mode = product.mode;
      if (product.self) r.self = product.self;
      if (product.label) r.label = product.label;
      if (product.shop) r.shop = product.shop;
    }

    const resNet = res && typeof res.net === 'number' ? res.net : 0;
    if (resNet > 0) {
      const nEl = document.getElementById('net-' + tid);
      if (nEl) { nEl.value = fmtWeight(resNet); r.net = round3(resNet); }
    } else if (product && (+product.gram || 0) > 0) {
      const tareVal = product.tare != null && product.tare !== '' ? round3(+product.tare) : round3(r.tare || 0);
      r.tare = tareVal;
      const netVal = Math.max(0, round3((+product.gram) - tareVal));
      const nEl = document.getElementById('net-' + tid);
      if (nEl && netVal > 0) { nEl.value = fmtWeight(netVal); r.net = netVal; }
    }

    recalc(tid);

    const tr = document.getElementById('row-' + tid);
    if (tr) {
      tr.style.transition = 'background .15s';
      tr.style.background = 'rgba(200,168,75,.22)';
      setTimeout(() => { tr.style.background = ''; }, 1000);
    }
  }

  async function apply(code) {
    code = cleanScannerCode(code);
    if (!code || applyBusy) return;
    applyBusy = true;
    try {
      const normalized = code.replace(/\s/g, '');

      const parsed = parseBC(normalized);
      let product = findItemByBarcode(normalized);
      if (!product && parsed) {
        if (parsed.code) product = findItemByCode(parsed.code);
        if (!product && parsed.plu) product = findItemByPlu(parsed.plu);
      }
      if (!product && typeof lookupItemAsync === 'function') {
        product = await lookupItemAsync(normalized);
        if (!product && parsed && parsed.code) product = await lookupItemAsync(parsed.code);
      }

      const dbByBarcode = product && (findItemByBarcode(normalized) || product);

      let res = null;
      if (parsed && (parsed.net > 0 || parsed.code || parsed.plu)) {
        res = {
          fmt: dbByBarcode ? 'DB' : parsed.fmt,
          code: parsed.code || (product && product.code ? String(product.code) : ''),
          plu: parsed.plu || (product && product.plu ? String(product.plu) : ''),
          net: parsed.net > 0 ? parsed.net : 0,
        };
      } else if (product) {
        const tareDb = round3(Number(product.tare) || 0);
        const net = Math.max(0, round3((+product.gram || 0) - tareDb));
        res = {
          fmt: 'DB',
          plu: product.plu,
          code: product.code || '',
          net,
        };
      }

      if (!res) {
        showFlash('✗ Barkod formaty nädogry ýa-da bazada ýok', 'err');
        return;
      }

      if (res.net <= 0 && product) {
        const tareDb = round3(Number(product.tare) || 0);
        res.net = Math.max(0, round3((+product.gram || 0) - tareDb));
      }

      const chipLbl = document.querySelector('#bc-chips .bc-chip-l');
      if (chipLbl) chipLbl.textContent = res.code ? 'Kod' : 'PLU';
      const bpPlu = document.getElementById('bp-plu');
      const bpNet = document.getElementById('bp-net');
      const bpFmt = document.getElementById('bp-fmt');
      if (bpPlu) bpPlu.textContent = (res.code || res.plu) || '—';
      if (bpNet) bpNet.textContent = res.net > 0 ? fmtWeight(res.net) + ' gr.' : '—';
      if (bpFmt) bpFmt.textContent = res.fmt;
      if (chips) chips.style.display = 'flex';

      const scanCode = (product && product.code) || res.code || '';
      const scanName = (product && product.name) || '';
      if (!assertSameInvoiceProduct(scanCode, scanName)) {
        inp.value = '';
        return;
      }

      await ensureInvoiceCapacityForNewRow();

      let tid = emptyRowForScan();
      if (tid === null) { addRow(); tid = emptyRowForScan(); }
      if (tid === null) { showFlash('✗ Ýalňyşlyk', 'err'); return; }

      if (product) {
        fillRow(tid, res, product);
        syncInvoiceProductMeta(product);
        showFlash('✓ ' + product.name, 'ok');
      } else {
        fillRow(tid, res, null);
        if (scanName) syncInvoiceProductMeta(scanName);
        showFlash('⚠ Kod ' + (res.code || res.plu || '—') + ' — bazada ýok, "Harytlar Bazasy"-dan goşuň', 'err');
      }

      inp.value = '';
      focusBarcodeInput();
      await checkInvoiceFullAfterAdd();
    } finally {
      applyBusy = false;
      scanBuf = '';
    }
  }

  function resetScanBuf() {
    scanBuf = '';
    burstMode = false;
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  function scheduleIdleFlush() {
    // Diňe skaner burst — el bilen haýal ýazmak Enter bilen gutarýar
    if (!burstMode) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (scanBuf.length >= SCAN_MIN_LEN) {
        const code = scanBuf;
        resetScanBuf();
        apply(code);
      } else {
        resetScanBuf();
      }
    }, SCAN_IDLE_MS);
  }

  function isTypingInOtherField(el) {
    if (!el || el === inp) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      return t !== 'button' && t !== 'submit' && t !== 'checkbox' && t !== 'radio' && t !== 'file' && t !== 'hidden';
    }
    return false;
  }

  // Capture phase — skaner harplary beýleki meýdanlara düşmez ýaly
  document.addEventListener('keydown', function (e) {
    if (!isInvoiceScanReady()) return;
    if (e.isComposing) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const active = document.activeElement;
    const onBc = active === inp;
    const onOther = isTypingInOtherField(active);
    const now = performance.now();
    const gap = now - lastKeyTs;

    // Enter ýa-da Tab = skaner gutardy
    if (e.key === 'Enter' || e.key === 'Tab') {
      const fromBuf = scanBuf.length >= SCAN_MIN_LEN;
      const fromInput = onBc && e.key === 'Enter';
      if (fromBuf || fromInput) {
        e.preventDefault();
        e.stopPropagation();
        const code = fromBuf ? scanBuf : inp.value;
        resetScanBuf();
        apply(code);
      }
      return;
    }

    if (e.key === 'Escape') {
      resetScanBuf();
      if (onBc) inp.value = '';
      return;
    }

    // Diňe görünýän belgi (skaner san iberýär)
    if (e.key.length !== 1) return;

    lastKeyTs = now;

    // Haýal ýazmak (el bilen başga meýdanda) — skanere goşma
    if (onOther && gap > SCAN_GAP_MS && scanBuf.length === 0) {
      return;
    }

    // Täze skan başlangyjy
    if (gap > SCAN_GAP_MS * 4 && scanBuf.length > 0) {
      scanBuf = '';
      burstMode = false;
    }

    if (gap <= SCAN_GAP_MS) burstMode = true;
    else if (scanBuf.length === 0 && !onBc) burstMode = true; // ilkinji harp fokus ýok ýerde

    const scannerBurst = burstMode || onBc || !onOther;

    if (!scannerBurst && onOther) return;

    // Skaner rejiminde — harpy buffer-e al, beýleki inputa ýazma
    if (!onBc || (onOther && burstMode)) {
      e.preventDefault();
      e.stopPropagation();
    }

    scanBuf += e.key;
    if (!onBc) inp.value = scanBuf;

    scheduleIdleFlush();
  }, true);

  // Skanerden soň fokus ýitmese — boş ýere basylanda yzyna
  document.addEventListener('click', function (e) {
    if (!isInvoiceScanReady()) return;
    const t = e.target;
    if (!t) return;
    if (isTypingInOtherField(t)) return;
    if (t.closest && (t.closest('button') || t.closest('a') || t.closest('select') || t.closest('.modal-overlay'))) return;
    // Tablisa öýjükleri: net/code üýtgetmek üçin fokus galsyn
    if (t.closest && t.closest('#tbody input, #tbody select, #tbody textarea')) return;
    focusBarcodeInput();
  });

  // Meýdandan çykylanda birneme soň skanere gaýt (skaner taýýar)
  inp.addEventListener('blur', function () {
    if (!isInvoiceScanReady()) return;
    setTimeout(() => {
      if (!isInvoiceScanReady()) return;
      const a = document.activeElement;
      if (isTypingInOtherField(a)) return;
      focusBarcodeInput();
    }, 600);
  });

})();

/* ══════════════════════════════════════════════════════
   ÇAP FORMASY — suratdaky gorizontal grid gurluşy
   15 sütun (rulon ýerleri) × N setir.
   - "Sany" = rulon sany (näçe rulon çap etmeli)
   - Her öýjük = 1 rulon (netto agramy)
   - Doldurma ýokardan aşak, sütün-sütün
   - S.B öýjüginde gram/kg saýlaýjy (başda kg, islese gr-a geçip bolýar)
   - Aşaky sary hatar = her sütündäki rulon sany
══════════════════════════════════════════════════════ */
let pfStates = null;

function getPrintUnit() {
  const el = document.getElementById('print-unit-preview');
  return el && el.value === 'gr' ? 'gr' : 'kg';
}

function getPrintWeightMode() {
  const el = document.getElementById('print-weight-mode-preview');
  return el && el.value === 'brutto' ? 'brutto' : 'netto';
}

function resetPrintPreviewOptions() {
  const unit = document.getElementById('print-unit-preview');
  const mode = document.getElementById('print-weight-mode-preview');
  if (unit) unit.value = 'kg';
  if (mode) mode.value = 'netto';
}

function onPrintOptionsChange() {
  if (pfStates && pfStates.length) renderPfValues();
  swapUnitsForPrint(true);
}

function buildPrintForma() {
  const num = document.getElementById('f-num').value || '—';
  const zawod = document.getElementById('f-zawod').value || '';
  const issued = document.getElementById('f-issued').value || '';
  const recv = document.getElementById('f-recv').value || '';
  const date = document.getElementById('f-date').value;

  let dateStr = '—';
  if (date) {
    const d = new Date(date + 'T12:00:00');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    dateStr = `${dd}.${mm}.${yy}`;
  }

  // Faktura tablisasyndaky ÄHLI doly setirler — her setir = bir agram (öýjük)
  const items = getItemsFromRows(true);

  if (items.length === 0) {
    alert('Haryt ýok — ilki haryt giriziň!');
    return false;
  }

  const firstKey = productKey(items[0].code, items[0].name);
  const mixed = items.some(x => productKey(x.code, x.name) !== firstKey);
  if (mixed) {
    alert('Sen ýalňyş çykardyň — bir çekde diňe bir haryt bolmaly!');
    return false;
  }

  const it0 = items[0];
  const tare0 = round3(it0.tare || 0);
  const net0 = round3(it0.net || 0);
  const gross0 = round3(it0.gross || (net0 + tare0));
  const it = { ...it0, net: net0, tare: tare0, gross: gross0 };
  // Netto / brutto — tegeklemesiz (round3 = 3 onluk, Math.round däl)
  const weights = items.map(x => round3(x.net || 0));
  const tareWeights = items.map(x => round3(x.tare || 0));
  const grossWeights = items.map((x, i) => {
    const g = round3(x.gross || 0);
    if (g > 0) return g;
    return round3(weights[i] + tareWeights[i]);
  });
  const perBlock = getPrintPerBlock();
  // Her setiriň öz Gapdaky haryt (box_qty) sanyny sakla — deňleşdirme!
  const boxQtys = items.map(x => parseBoxQty(x.box_qty, perBlock));

  const COLS = 15;
  const MAX_ROWS = 10;

  const blocks = weights.length;

  const blocksPerPage = COLS * MAX_ROWS;
  const pages = Math.max(1, Math.ceil(blocks / blocksPerPage));

  pfStates = Array.from({ length: pages }, (_, pi) => {
    const start = pi * blocksPerPage;
    const end = Math.min(blocks, start + blocksPerPage);
    const w = weights.slice(start, end);
    const gw = grossWeights.slice(start, end);
    const tw = tareWeights.slice(start, end);
    const bq = boxQtys.slice(start, end);
    const meta = buildSaryMetaFromBlocks(bq, COLS, MAX_ROWS, perBlock);
    const st = {
      it,
      weights: w,
      grossWeights: gw,
      tareWeights: tw,
      boxQtys: bq,
      saryQtys: meta.saryQtys,
      saryMixed: meta.saryMixed,
      saryColSums: meta.saryColSums,
      _itemOffset: start,
      blocks: w.length,
      COLS,
      ROWS: MAX_ROWS
    };
    st.bqty = calcPageRulonTotal(st);
    return st;
  });

  const initBqty = pfStates.reduce((s, st) => s + st.bqty, 0);

  // Default görnüş netto — başlykda hem takyk netto (brutto saýlananda renderPfValues üýtgedýär)
  const gramVal = it.net > 0
    ? fmtPrintWeightHdr(it.net, 'kg')
    : (it.gross > 0 ? fmtPrintWeightHdr(it.gross, 'kg') : '');
  const iniVal = it.width ? it.width + ' mm' : '';
  const headCode = (it.code != null ? String(it.code) : '').trim();
  const headPlu = (it.plu != null ? String(it.plu) : '').trim();
  const headKey = headPlu || headCode;
  const colNumCells = Array.from({ length: COLS }, (_, i) => `<td>${i + 1}</td>`).join('');

  const oneCopy = `
  <div class="pf-copy">
  <div class="pf-title-bar">
    <span class="pf-title-txt">Ammar çykyş fakturasy</span>
    <span class="pf-title-num">№ ${num}</span>
    ${zawod ? `<span class="pf-title-zawod">${zawod}</span>` : ''}
  </div>

  <table class="pf-grid">
    <colgroup>
      <col class="pf-col-rn" style="width:5%"/>
      ${Array(COLS).fill('<col class="pf-col-data"/>').join('')}
      <col class="pf-col-jemi" style="width:7%"/>
    </colgroup>
    <thead>
      <tr>
        <td class="th-sb"><span class="pf-unit-print-lbl">kg</span></td>
        <td class="th-plu" colspan="2">${headKey}</td>
        <td class="th-alyjy-lbl">Alyjy</td>
        <td class="th-ady" colspan="6">${escapeHtml(it.name || '')}</td>
        <td class="th-gr" colspan="2">${gramVal}</td>
        <td class="th-mm" colspan="2">${iniVal}</td>
        <td class="th-lik">3lik</td>
        <td class="th-sene" colspan="2">${dateStr}</td>
      </tr>
      <tr class="pf-colnum-row">
        <td class="td-net-lbl">NET</td>
        ${colNumCells}
        <td class="td-jemi-lbl pf-jemi-lbl">Jemi, kg</td>
      </tr>
    </thead>
    <tbody class="pf-body"></tbody>
  </table>

  <div class="pf-footer">
    <div><span class="flbl pf-brutto-lbl">Brutto, kg:</span><span class="fval pf-brutto">0</span></div>
    <div><span class="flbl pf-gilza-lbl">Gilza, kg:</span><span class="fval pf-gilza">0</span></div>
    <div><span class="flbl pf-netto-lbl">Netto, kg:</span><span class="fval pf-netto">0</span></div>
    <div><span class="flbl">Jemi rulon:</span><span class="fval pf-rulon">${initBqty || 0}</span></div>
  </div>

  <div class="pf-sigs">
    <div class="pf-sig">
      <div class="pf-sig-name">Tabşyran:&nbsp;${issued}</div>
      <div class="pf-sig-line"></div>
    </div>
    <div class="pf-sig">
      <div class="pf-sig-name">Kabul eden:&nbsp;${recv}</div>
      <div class="pf-sig-line"></div>
    </div>
  </div>
  </div>`;

  const pagesHtml = pfStates.map((_, pi) => `
    <div class="pf-page" data-pi="${pi}">
      ${oneCopy}
      ${oneCopy}
    </div>
  `).join('');

  document.getElementById('pf-wrap').innerHTML = pagesHtml;
  renderPfValues();
  return true;
}

/* Grid öýjüklerini saýlanan birlikde (gr/kg) gaýtadan çyzýar */
function renderPfValues() {
  if (!pfStates || pfStates.length === 0) return;
  const unit = getPrintUnit();
  const weightMode = getPrintWeightMode();
  const weightLbl = weightMode === 'brutto' ? 'BRUT' : 'NET';
  const fmt = (g) => fmtPrintWeight(g, unit);
  const fmtHdr = (g) => fmtPrintWeightHdr(g, unit);
  const unitText = unit === 'gr' ? 'gr.' : 'kg';
  document.querySelectorAll('.pf-unit-print-lbl').forEach(el => { el.textContent = unitText; });

  document.querySelectorAll('.pf-page').forEach((pageEl, idx) => {
    const st = pfStates[idx];
    if (!st) return;
    const { weights, grossWeights, tareWeights, boxQtys, blocks, COLS, ROWS } = st;
    const cellWeights = weightMode === 'brutto' ? grossWeights : weights;

    const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    const qtyGrid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    let placed = 0;
    outer:
    for (let ci = 0; ci < COLS; ci++) {
      for (let ri = 0; ri < ROWS; ri++) {
        if (placed >= blocks) break outer;
        grid[ri][ci] = cellWeights[placed];
        qtyGrid[ri][ci] = boxQtys[placed] ?? getPrintPerBlock();
        placed++;
      }
    }

    let dataRows = '';
    for (let r = 0; r < ROWS; r++) {
      let rowWeight = 0;
      const cells = grid[r].map((w, ci) => {
        const on = w !== null;
        const q = qtyGrid[r][ci] || 1;
        if (on) rowWeight = round3(rowWeight + round3(w) * q);
        return `<td class="td-cell${on ? ' filled' : ''}">${on ? fmt(w) : ''}</td>`;
      }).join('');
      dataRows += `<tr class="pf-data-row">
        <td class="td-rn">${r + 1}</td>
        ${cells}
        <td class="td-jemi-val${rowWeight > 0 ? ' filled' : ''}">${rowWeight > 0 ? fmt(rowWeight) : ''}</td>
      </tr>`;
    }

    const saryCells = Array.from({ length: COLS }, (_, ci) => {
      let hasData = false;
      const colQs = [];
      for (let ri = 0; ri < ROWS; ri++) {
        if (grid[ri][ci] !== null) {
          hasData = true;
          colQs.push(parseBoxQty(qtyGrid[ri][ci], getPrintPerBlock()));
        }
      }
      if (!hasData) return `<td></td>`;
      const mixed = st.saryMixed?.[ci] || (colQs.length > 1 && colQs.some(q => q !== colQs[0]));
      const colSum = colQs.reduce((a, b) => a + b, 0);
      if (mixed) {
        // Dürli rulon: 3+3+3+3+1 — bir san bilen ýalňyş görkezme
        return `<td class="pf-sary-mixed" title="${colQs.join(' + ')} = ${colSum}"><span>${colSum}</span></td>`;
      }
      const saryVal = parseBoxQty(st.saryQtys?.[ci], getPrintPerBlock());
      return `<td><input class="pf-sary-in" type="number" min="1" step="1" value="${saryVal}" data-pi="${idx}" data-col="${ci}" onchange="onPfSaryInput(this)" onblur="onPfSaryInput(this)"/></td>`;
    }).join('');

    const pageBqty = calcPageRulonTotal(st);
    const saryRow = `<tr class="pf-sary-row">
      <td class="td-sary-empty"></td>
      ${saryCells}
      <td class="pf-rulon-total">${pageBqty || 0}</td>
    </tr>`;

    const totalNetto = round3(weights.reduce((s, w, i) => s + w * (boxQtys[i] || 1), 0));
    const totalBrutto = round3((grossWeights || []).reduce((s, w, i) => s + w * (boxQtys[i] || 1), 0));
    const totalGilza = round3((tareWeights || []).reduce((s, w, i) => s + w * (boxQtys[i] || 1), 0));
    const unitLbl = unit === 'gr' ? 'gr' : 'kg';

    pageEl.querySelectorAll('.pf-body').forEach(b => { b.innerHTML = dataRows + saryRow; });
    pageEl.querySelectorAll('.td-net-lbl').forEach(e => { e.textContent = weightLbl; });
    const hdrGram = weightMode === 'brutto' ? (st.it.gross || 0) : (st.it.net || 0);
    pageEl.querySelectorAll('.th-gr').forEach(e => {
      e.textContent = hdrGram > 0 ? fmtHdr(hdrGram) : '';
    });
    pageEl.querySelectorAll('.pf-jemi-lbl').forEach(e => { e.textContent = 'Jemi, ' + unitLbl; });
    pageEl.querySelectorAll('.pf-brutto-lbl').forEach(e => { e.textContent = 'Brutto, ' + unitLbl + ':'; });
    pageEl.querySelectorAll('.pf-brutto').forEach(e => { e.textContent = fmt(totalBrutto); });
    pageEl.querySelectorAll('.pf-gilza-lbl').forEach(e => { e.textContent = 'Gilza, ' + unitLbl + ':'; });
    pageEl.querySelectorAll('.pf-gilza').forEach(e => { e.textContent = fmt(totalGilza); });
    pageEl.querySelectorAll('.pf-netto-lbl').forEach(e => { e.textContent = 'Netto, ' + unitLbl + ':'; });
    pageEl.querySelectorAll('.pf-netto').forEach(e => { e.textContent = fmt(totalNetto); });
    pageEl.querySelectorAll('.pf-rulon').forEach(e => { e.textContent = String(pageBqty || 0); });
  });

  fitPrintPages();
}

function onPfSaryInput(inp) {
  const pi = parseInt(inp.dataset.pi, 10);
  const col = parseInt(inp.dataset.col, 10);
  const qty = parseBoxQty(inp.value, getPrintPerBlock());
  inp.value = qty;
  const st = pfStates[pi];
  if (!st) return;
  if (!st.saryQtys) st.saryQtys = Array(st.COLS).fill(getPrintPerBlock());
  st.saryQtys[col] = qty;
  if (st.saryMixed) st.saryMixed[col] = false;
  // Diňe şol sütündäki ähli bloklar deň san — aýratyn setirler tablisada üýtgedilýär
  const { COLS, ROWS, blocks, boxQtys } = st;
  let placed = 0;
  outer:
  for (let ci = 0; ci < COLS; ci++) {
    for (let ri = 0; ri < ROWS; ri++) {
      if (placed >= blocks) break outer;
      if (ci === col && boxQtys) boxQtys[placed] = qty;
      placed++;
    }
  }
  syncInvoiceBoxQtysFromPrintState(st);
  const meta = buildSaryMetaFromBlocks(st.boxQtys, COLS, ROWS, getPrintPerBlock());
  st.saryQtys = meta.saryQtys;
  st.saryMixed = meta.saryMixed;
  st.saryColSums = meta.saryColSums;
  updatePfRulonTotals(pi);
  renderPfValues();
}

/* Öňünden görnüş — diňe ekranda, çap bilen birmeňzeş */
function resetPrintLayout() {
  document.querySelectorAll('.pf-page').forEach(page => {
    page.style.transform = '';
    page.style.height = '';
    page.style.width = '';
    page.style.marginLeft = '';
    page.style.marginRight = '';
  });
}

function fitPrintPages() {
  resetPrintLayout();
}

function openPrint() {
  resetPrintPreviewOptions();
  if (buildPrintForma()) {
    swapUnitsForPrint(true);
    document.getElementById('print-preview').classList.add('open');
  }
}
function closePrintPreview() {
  const el = document.getElementById('print-preview');
  if (el) el.classList.remove('open');
}

/* Çap üçin minimal CSS — diňe faktura, beýleki sahypa stili aragtyrmaz */
function getPrintFormaStyles() {
  return `
@page{size:A4 portrait;margin:12mm 10mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pf-page{page-break-after:always;padding-top:2mm}
.pf-page:last-child{page-break-after:auto}
.pf-copy{page-break-inside:avoid;margin-bottom:0}
.pf-copy+.pf-copy{margin-top:8mm;padding-top:8mm;border-top:1px dashed #666}
.pf-title-bar{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:6px;font-size:13px;font-weight:700}
.pf-title-num{border:2px solid #000;padding:1px 8px;font-size:15px;font-weight:900}
.pf-title-zawod{margin-left:auto;font-size:9px;font-weight:400;color:#333}
.pf-grid{width:100%;border-collapse:collapse;table-layout:fixed}
.pf-grid td{border:1px solid #000;padding:4px 3px;font-size:9px;text-align:center;vertical-align:middle;line-height:1.3;overflow:visible;word-wrap:break-word;color:#000;background:#fff}
.pf-grid thead td{padding:5px 4px;font-size:9px;font-weight:700}
.th-sb,.td-net-lbl,.td-jemi-lbl{font-weight:900;border:2px solid #000!important;background:#fff!important;color:#000!important}
.th-ady{text-align:left!important;padding-left:5px!important;font-size:9px}
.th-alyjy-lbl{background:#eee!important;color:#000!important}
.th-plu,.th-gr,.th-mm,.th-sene{font-family:monospace;font-weight:700;color:#000!important}
.pf-colnum-row td{background:#eee!important;color:#000!important;font-size:8px;font-weight:700}
.pf-data-row .td-rn{background:#eee!important;color:#000!important;font-size:8px;font-weight:700}
.pf-data-row .td-cell{font-family:Consolas,monospace;font-size:9px;min-height:16px;height:auto;color:#000}
.pf-data-row .td-cell.filled{font-weight:700}
.pf-data-row .td-jemi-val{font-weight:900;border:2px solid #000!important;background:#fff!important;color:#000!important}
.pf-sary-row td{background:#f5c518!important;color:#000!important;font-weight:700;font-size:9px;border-color:#000!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pf-sary-row .td-sary-empty{background:#fff!important;border:none!important}
.pf-sary-row .pf-sary-in{border:none;background:transparent;font-weight:700;font-size:9px;color:#000;text-align:center;width:100%;font-family:inherit}
.pf-sary-row .pf-sary-mixed{font-weight:900;font-size:9px;text-align:center}
.pf-unit-sel{display:none!important}
.pf-unit-print-lbl{display:inline!important;color:#000!important;font-weight:900;font-size:10px}
.pf-footer{display:flex;flex-wrap:wrap;gap:16px;margin-top:6px;justify-content:flex-end;font-size:9px;font-weight:700}
.pf-footer .fval{font-family:monospace;font-size:11px;border-bottom:1.5px solid #000;padding:0 6px;min-width:44px;display:inline-block;text-align:right}
.pf-sigs{display:flex;gap:20px;margin-top:12px}
.pf-sig{flex:1}
.pf-sig-name{font-size:9px;margin-bottom:10px;font-weight:600}
.pf-sig-line{border-bottom:1px solid #000;height:12px}
`;
}

function printFormaViaIframe() {
  const wrap = document.getElementById('pf-wrap');
  if (!wrap || !wrap.innerHTML.trim()) {
    alert('Ilki faktura çap öňünden görnüşini açyň!');
    return false;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0'
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Faktura</title>');
  doc.write('<style>' + getPrintFormaStyles() + '</style></head><body>');
  doc.write(wrap.innerHTML);
  doc.write('</body></html>');
  doc.close();

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 300);
    win.removeEventListener('afterprint', cleanup);
  };
  win.addEventListener('afterprint', cleanup);

  setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
  return true;
}

function swapUnitsForPrint(on) {
  if (!on) return;
  const unitText = getPrintUnit() === 'gr' ? 'gr.' : 'kg';
  document.querySelectorAll('.pf-unit-print-lbl').forEach(span => {
    span.textContent = unitText;
  });
}

function doPrint() {
  resetPrintLayout();
  syncSaryQtysFromPreview();
  pfStates?.forEach((_, pi) => updatePfRulonTotals(pi));
  swapUnitsForPrint(true);
  printFormaViaIframe();
}
