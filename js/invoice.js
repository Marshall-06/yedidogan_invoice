'use strict';

/* ══════════════════════════════════════════════════════
   INVOICE — "Faktura Düzmek" sahypasynyň logikasy
   Setir goşmak, netto/jem hasaplamalar, haryt saýlaýjy
   modal (bazadan), barkod skan we çap formasy.
══════════════════════════════════════════════════════ */

const MODES = ['Ters', 'Göni', 'Ters+Göni', 'Aýlaw', 'Beýleki'];

let rid = 0;
const rows = new Map();
let currentInvoiceId = null;

function setCurrentInvoice(id) {
  currentInvoiceId = id != null ? Number(id) : null;
}

function resetInvoiceFormMeta() {
  document.getElementById('f-num').value = '';
  document.getElementById('f-zawod').value = '';
  document.getElementById('f-sklad').value = '';
  document.getElementById('f-issued').value = '';
  document.getElementById('f-recv').value = '';
  document.getElementById('stamp-num').textContent = '—';
  document.getElementById('org-display').textContent = 'Zawodyň ady';
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
  const pbEl = document.getElementById('print-perblock');
  if (!pbEl) return;
  const qtys = [];
  for (const tr of document.querySelectorAll('#tbody tr')) {
    const id = parseInt(tr.dataset.id, 10);
    syncRowFromDom(id);
    const r = rows.get(id);
    if (!r || (!r.code && !r.name)) continue;
    qtys.push(parseBoxQty(r.box_qty));
  }
  if (qtys.length === 0) return;
  if (qtys.every(q => q === qtys[0])) pbEl.value = qtys[0];
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
  const qty = parseBoxQty(pbEl.value);
  pbEl.value = qty;
  applyPrintPerBlockToRows(qty);
}

function onRowBoxQtyChange(id, el) {
  const qty = parseBoxQty(el.value);
  el.value = qty;
  const r = rows.get(id);
  if (r) r.box_qty = qty;
  syncPrintPerBlockFromRows();
  refreshPfBoxQtysFromRows();
}

function getItemsFromRows() {
  const items = [];
  document.querySelectorAll('#tbody tr').forEach(tr => {
    const id = parseInt(tr.dataset.id, 10);
    syncRowFromDom(id);
    const r = rows.get(id);
    if (!r || (!r.code && !r.name)) return;
    items.push({ ...r });
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
  const items = getItemsFromRows();
  let idx = 0;
  for (const st of pfStates) {
    for (let i = 0; i < st.boxQtys.length; i++) {
      st.boxQtys[i] = parseBoxQty(items[idx]?.box_qty);
      idx++;
    }
    st.bqty = calcPageRulonTotal(st);
  }
  renderPfValues();
}

/* Sary hat = sütün başyna default 2; jemi hasap = her blok üçin faktura box_qty */
function calcPageRulonTotal(st) {
  const { COLS, ROWS, blocks } = st;
  const sq = st.saryQtys || Array(COLS).fill(2);
  let placed = 0;
  let total = 0;
  outer:
  for (let ci = 0; ci < COLS; ci++) {
    for (let ri = 0; ri < ROWS; ri++) {
      if (placed >= blocks) break outer;
      total += parseBoxQty(sq[ci], 2);
      placed++;
    }
  }
  return total;
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
    if (!st.saryQtys) st.saryQtys = Array(st.COLS).fill(2);
    st.saryQtys[col] = parseBoxQty(inp.value, 2);
    inp.setAttribute('value', inp.value);
  });
}

function newInvoice() {
  closePrintPreview();
  setCurrentInvoice(null);
  resetInvoiceFormMeta();
  resetInvoiceRows();
  setInvoiceEditorVisible(true);
  if (typeof refreshItems === 'function') refreshItems('').catch(() => { });
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

/* ══ ITEM PICKER MODAL (bazadan haryt saýlamak) ══ */
async function openItemPicker() {
  document.getElementById('item-modal-overlay').classList.add('open');
  document.getElementById('item-search').value = '';
  const list = document.getElementById('item-list');
  list.innerHTML = `<div class="item-empty">Ýüklenýär…</div>`;
  try { await refreshItems(''); }
  catch (e) { list.innerHTML = `<div class="item-empty">Serwere birikip bolmady: ${escapeHtml(e.message)}</div>`; return; }
  renderItemList();
  setTimeout(() => document.getElementById('item-search').focus(), 50);
}
function closeItemPicker() {
  document.getElementById('item-modal-overlay').classList.remove('open');
}

function renderItemList() {
  const q = (document.getElementById('item-search').value || '').trim().toLowerCase();
  const list = document.getElementById('item-list');
  const filtered = ITEM_DB.filter(it => {
    if (!q) return true;
    return (it.name || '').toLowerCase().includes(q)
      || String(it.plu ?? '').toLowerCase().includes(q)
      || String(it.code ?? '').toLowerCase().includes(q)
      || (it.barcode || '').toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="item-empty">Haryt tapylmady — "Harytlar Bazasy" sahypasyndan goşuň.</div>`;
    return;
  }

  list.innerHTML = filtered.map(it => `
    <div class="item-card" onclick="pickItem('${it.id}')">
      <div class="ic-info">
        <div class="ic-name">${escapeHtml(it.name || '(adsyz)')}</div>
        <div class="ic-meta">Kod ${escapeHtml(String(it.code ?? '—'))} · PLU ${escapeHtml(String(it.plu ?? '—'))} · ${it.gram || 0}g · ${it.mm || 0}mm · ${escapeHtml(it.barcode || 'barkodsuz')}</div>
      </div>
      <button class="ic-pick" onclick="event.stopPropagation();pickItem('${it.id}')">Saýla</button>
    </div>
  `).join('');
}

// Bazadan haryt saýlananda — faktura tablisasyna täze setir goşulýar
function pickItem(id) {
  const it = findItem(id);
  if (!it) return;
  if (!assertSameInvoiceProduct(it.code, it.name)) return;
  const tare = parseFloat(it.tare) || 0;
  const brutto = +it.gram || 0;
  const net = Math.max(0, Math.round(brutto - tare));
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
    box_qty: 2
  });
  closeItemPicker();
}

/* ══ ADD ROW ═════════════════════════════════════════════ */
function addRow(p) {
  const id = ++rid;
  const tare = parseFloat(p?.tare) || 0;
  const gross = parseFloat(p?.gross) || 0;
  const net = p?.net != null ? (parseFloat(p.net) || 0) : Math.max(0, gross - tare);
  rows.set(id, {
    plu: p?.plu || '',
    name: p?.name || '',
    code: p?.code || '',
    width: p?.width || '',
    mode: p?.mode || '',
    net,
    tare,
    gross: net + tare,
    self: p?.self || '',
    label: p?.label || '',
    shop: p?.shop || '',
    box_qty: p?.box_qty || 2
  });
  const tb = document.getElementById('tbody');
  const tr = document.createElement('tr');
  tr.id = 'row-' + id; tr.dataset.id = id;
  tr.innerHTML = rowHTML(id, tb.rows.length + 1, rows.get(id));
  tb.appendChild(tr);
  renumber();
  recalc(id);
  return id;
}

function rowHTML(id, n, p) {
  const r = p || {};
  const tare = parseFloat(r.tare) || 0;
  const gross = parseFloat(r.gross) || 0;
  const net = r.net != null ? (parseFloat(r.net) || 0) : Math.max(0, gross - tare);
  const brutto = net + tare;
  return `
  <td class="rn" id="rn-${id}">${n}</td>
  <td><input class="ci w-code" id="code-${id}" value="${r.code || ''}" placeholder="S22"
       oninput="setf(${id},'code',this.value)"/></td>
  <td><input class="ci w-plu mn" id="plu-${id}" value="${r.plu || ''}" placeholder="21025"
       oninput="setf(${id},'plu',this.value)"/></td>
  <td class="tl"><input class="ci tl w-name" id="name-${id}" value="${r.name || ''}" placeholder="Harydyň ady…"
       oninput="setf(${id},'name',this.value)"/></td>
  <td><input class="ci w-med mn" type="number" min="0" step="1" id="net-${id}"
       value="${net > 0 ? Math.round(net) : ''}" placeholder="0"
       oninput="onNetto(${id},this.value)"/></td>
  <td><span class="cc" id="gross-${id}">${brutto > 0 ? fg(brutto) : '—'}</span></td>
  <td><input class="ci w-num mn" type="number" min="1" step="1" id="bqty-${id}"
       value="${r.box_qty || 2}" placeholder="2"
       onchange="onRowBoxQtyChange(${id},this)" onblur="onRowBoxQtyChange(${id},this)"/></td>
  <td><button class="btn-del" onclick="delRow(${id})" title="Poz">✕</button></td>`;
}

/* ══ HANDLERS ════════════════════════════════════════════ */
function setf(id, f, v) {
  const r = rows.get(id);
  if (r) r[f] = v;
}

function onNetto(id, v) {
  const r = rows.get(id); if (!r) return;
  r.net = parseFloat(v) || 0;
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
  r.net = parseFloat(el('net')?.value) || 0;
  r.gross = (parseFloat(r.net) || 0) + (parseFloat(r.tare) || 0);
}

/* ══ RECALC: Brutto = Netto + Gilza(Tare) ══ */
function recalc(id) {
  const r = rows.get(id); if (!r) return;
  r.gross = (parseFloat(r.net) || 0) + (parseFloat(r.tare) || 0);
  const el = document.getElementById('gross-' + id);
  if (el) el.textContent = r.gross > 0 ? fg(r.gross) : '—';
  totals();
}

/* Agram formatlaýjy — gram (bütin san) */
function fg(n) { return String(Math.round(Number(n) || 0)); }

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
  document.querySelectorAll('#tbody tr').forEach((tr, i) => {
    const el = document.getElementById('rn-' + tr.dataset.id);
    if (el) el.textContent = i + 1;
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
  document.querySelectorAll('#tbody tr').forEach(tr => {
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

  const b = document.querySelector('.btn-save');
  const o = b.innerHTML;
  const isEdit = !!currentInvoiceId;
  try {
    let saved;
    if (isEdit) {
      try {
        saved = await API.invoices.update(currentInvoiceId, data);
      } catch (e) {
        if (e && e.status === 404) {
          saved = await API.invoices.patch(currentInvoiceId, data);
        } else {
          throw e;
        }
      }
    } else {
      saved = await API.invoices.create(data);
      if (saved && saved.id) setCurrentInvoice(saved.id);
    }
    b.innerHTML = isEdit ? '✓ Täzelendi' : '✓ Saklandy';
    b.style.cssText = 'background:#1e6b45;color:#fff';
    setTimeout(() => { b.innerHTML = o; b.style.cssText = '' }, 1800);
    if (typeof refreshInvoicesIndex === 'function') refreshInvoicesIndex().catch(() => { });
  } catch (e) { alert('Ýalňyşlyk: ' + e.message) }
}

async function loadInvoice(id) {
  let inv;
  try { inv = await API.invoices.get(id); }
  catch (e) { alert('Ýalňyşlyk: ' + e.message); return; }
  if (!inv) return;

  if (typeof refreshItems === 'function') {
    try { await refreshItems(''); } catch (e) { /* skan üçin keş täzelenmegi gerek däl */ }
  }

  setCurrentInvoice(inv.id);
  closePrintPreview();
  setInvoiceEditorVisible(true);

  document.getElementById('f-num').value = inv.fakturaNo || '';
  document.getElementById('stamp-num').textContent = inv.fakturaNo || '—';
  document.getElementById('f-zawod').value = inv.zawod || '';
  document.getElementById('org-display').textContent = inv.zawod || 'Zawodyň ady';
  document.getElementById('f-sklad').value = inv.sklad || '';
  document.getElementById('f-date').value = inv.date || '';
  document.getElementById('f-issued').value = inv.issued || '';
  document.getElementById('f-recv').value = inv.received || '';

  // footer date sync
  const d = inv.date ? new Date(inv.date + 'T12:00:00') : new Date();
  document.getElementById('foot-date').textContent =
    d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // rows
  document.getElementById('tbody').innerHTML = '';
  document.getElementById('tfoot').innerHTML = '';
  rows.clear(); rid = 0;

  (inv.items || []).forEach(it => {
    const gross = parseFloat(it.gross) || 0;
    const tare = parseFloat(it.tare) || 0;
    const net = it.net != null ? (parseFloat(it.net) || 0) : Math.max(0, gross - tare);
    addRow({
      plu: it.plu != null ? String(it.plu) : '',
      name: it.name || '',
      code: it.code || '',
      width: it.width || '',
      mode: it.mode || '',
      net,
      tare,
      gross: net + tare,
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
  try { list = (await API.invoices.list()) || []; }
  catch (e) { wrap.innerHTML = `<div class="inv-empty">Ýalňyşlyk: ${escapeHtml(e.message)}</div>`; return; }
  if (list.length === 0) {
    wrap.innerHTML = `<div class="inv-empty">Faktura ýok.</div>`;
    return;
  }
  wrap.innerHTML = list.slice(0, 30).map(inv => {
    const itCount = Array.isArray(inv.items) ? inv.items.length : 0;
    const title = `#${inv.id}` + (inv.fakturaNo ? ` · № ${escapeHtml(inv.fakturaNo)}` : '');
    const sub = `${inv.date || '—'} · setir: ${itCount}` + (inv.sklad ? ` · ${escapeHtml(inv.sklad)}` : '');
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

/* ══ BARCODE SKAN (faktura sahypasynda) ══════════════════
   Diňe Enter basylanda işleýär (skaner hem Enter iberýär).
   Barkod ITEM_DB-den gözlenýär.
══════════════════════════════════════════════════════ */
(function () {
  const inp = document.getElementById('bc-in');
  const flash = document.getElementById('bc-flash');
  const chips = document.getElementById('bc-chips');
  if (!inp) return;

  function showFlash(msg, type) {
    flash.textContent = msg; flash.className = 'bc-flash ' + type;
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
    // PLU diňe bazadan gelen harytdan — barkoddaky "plu" aslynda köplenç Kod bolýar.
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
      if (product.tare != null && product.tare !== '') r.tare = +product.tare;
      if (product.mode) r.mode = product.mode;
      if (product.self) r.self = product.self;
      if (product.label) r.label = product.label;
      if (product.shop) r.shop = product.shop;
    }

    // Barkoddan gelen agram NETTO (arassa) bolýar.
    // Brutto = netto + tare (awtomatik hasaplanýar).
    const resNet = res && typeof res.net === 'number' ? res.net : 0;
    if (resNet > 0) {
      const nEl = document.getElementById('net-' + tid);
      if (nEl) { nEl.value = String(Math.round(resNet)); r.net = resNet; }
    } else if (product && product.gram) {
      const tareVal = (product.tare) ? (+product.tare) : (r.tare || 0);
      const netVal = Math.max(0, (+product.gram) - tareVal);
      const nEl = document.getElementById('net-' + tid);
      if (nEl && netVal > 0) { nEl.value = String(Math.round(netVal)); r.net = netVal; }
    }

    recalc(tid);

    const tr = document.getElementById('row-' + tid);
    if (tr) {
      tr.style.transition = 'background .15s';
      tr.style.background = 'rgba(200,168,75,.22)';
      setTimeout(() => { tr.style.background = ''; }, 1000);
    }

    const nEl = document.getElementById('name-' + tid);
    if (nEl && !nEl.value.trim()) nEl.focus();
    else {
      const netEl = document.getElementById('net-' + tid);
      if (netEl && !netEl.value) netEl.focus();
    }
  }

  function apply(code) {
    code = code.trim(); if (!code) return;
    const normalized = code.replace(/\s/g, '');

    const dbByBarcode = findItemByBarcode(normalized);
    const parsed = parseBC(normalized);

    let product = dbByBarcode;
    if (!product && parsed) {
      if (parsed.code) product = findItemByCode(parsed.code);
      if (!product && parsed.plu) product = findItemByPlu(parsed.plu);
    }

    let res = null;
    if (parsed && (parsed.net > 0 || parsed.code || parsed.plu)) {
      res = {
        fmt: dbByBarcode ? 'DB' : parsed.fmt,
        code: parsed.code || (product && product.code ? String(product.code) : ''),
        plu: parsed.plu || (product && product.plu ? String(product.plu) : ''),
        net: parsed.net > 0 ? parsed.net : 0,
      };
    } else if (dbByBarcode) {
      const tareDb = Number(dbByBarcode.tare) || 0;
      const net = Math.max(0, Math.round((+dbByBarcode.gram || 0) - tareDb));
      res = {
        fmt: 'DB',
        plu: dbByBarcode.plu,
        code: dbByBarcode.code || '',
        net,
      };
    }

    if (!res) {
      showFlash('✗ Barkod formaty nädogry ýa-da bazada ýok', 'err');
      return;
    }

    if (res.net <= 0 && product) {
      const tareDb = Number(product.tare) || 0;
      res.net = Math.max(0, Math.round((+product.gram || 0) - tareDb));
    }

    const chipLbl = document.querySelector('#bc-chips .bc-chip-l');
    if (chipLbl) chipLbl.textContent = res.code ? 'Kod' : 'PLU';
    document.getElementById('bp-plu').textContent = (res.code || res.plu) || '—';
    document.getElementById('bp-net').textContent = res.net > 0 ? Math.round(res.net) + ' gr.' : '—';
    document.getElementById('bp-fmt').textContent = res.fmt;
    chips.style.display = 'flex';

    const scanCode = (product && product.code) || res.code || '';
    const scanName = (product && product.name) || '';
    if (!assertSameInvoiceProduct(scanCode, scanName)) {
      inp.value = '';
      return;
    }

    let tid = emptyRowForScan();
    if (tid === null) { addRow(); tid = emptyRowForScan(); }
    if (tid === null) { showFlash('✗ Ýalňyşlyk', 'err'); return; }

    if (product) {
      fillRow(tid, res, product);
      showFlash('✓ ' + product.name, 'ok');
    } else {
      fillRow(tid, res, null);
      showFlash('⚠ Kod ' + (res.code || res.plu || '—') + ' — bazada ýok, "Harytlar Bazasy"-dan goşuň', 'err');
    }

    inp.value = '';
  }

  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); apply(this.value); }
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
  const items = [];
  document.querySelectorAll('#tbody tr').forEach(tr => {
    const id = parseInt(tr.dataset.id);
    syncRowFromDom(id);
    const r = rows.get(id); if (!r) return;
    if (!r.code && !r.name) return;
    items.push({ ...r, net: r.net });
  });

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

  const it = items[0];
  const weights = items.map(x => x.net);
  const grossWeights = items.map(x => x.gross || 0);
  const tareWeights = items.map(x => x.tare || 0);
  const perBlock = getPrintPerBlock();
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
    const st = {
      it,
      weights: w,
      grossWeights: gw,
      tareWeights: tw,
      boxQtys: bq,
      saryQtys: Array(COLS).fill(2),
      blocks: w.length,
      COLS,
      ROWS: MAX_ROWS
    };
    st.bqty = calcPageRulonTotal(st);
    return st;
  });

  const initBqty = pfStates.reduce((s, st) => s + st.bqty, 0);

  const gramVal = it.gross > 0 ? (it.gross / 1000).toFixed(2) + ' kg' : '';
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
  const fmt = (g) => unit === 'gr' ? String(Math.round(g)) : (g / 1000).toFixed(2);
  const fmtHdr = (g) => unit === 'gr' ? Math.round(g) + ' gr.' : (g / 1000).toFixed(2) + ' kg';
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
        qtyGrid[ri][ci] = boxQtys[placed] ?? 2;
        placed++;
      }
    }

    let dataRows = '';
    for (let r = 0; r < ROWS; r++) {
      let rowWeight = 0;
      const cells = grid[r].map((w, ci) => {
        const on = w !== null;
        const q = qtyGrid[r][ci] || 1;
        if (on) rowWeight += w * q;
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
      for (let ri = 0; ri < ROWS; ri++) {
        if (grid[ri][ci] !== null) hasData = true;
      }
      if (!hasData) return `<td></td>`;
      const saryVal = parseBoxQty(st.saryQtys?.[ci], 2);
      return `<td><input class="pf-sary-in" type="number" min="1" step="1" value="${saryVal}" data-pi="${idx}" data-col="${ci}" onchange="onPfSaryInput(this)" onblur="onPfSaryInput(this)"/></td>`;
    }).join('');

    const pageBqty = calcPageRulonTotal(st);
    const saryRow = `<tr class="pf-sary-row">
      <td class="td-sary-empty"></td>
      ${saryCells}
      <td class="pf-rulon-total">${pageBqty || 0}</td>
    </tr>`;

    const totalNetto = weights.reduce((s, w, i) => s + w * (boxQtys[i] || 1), 0);
    const totalBrutto = (grossWeights || []).reduce((s, w, i) => s + w * (boxQtys[i] || 1), 0);
    const totalGilza = (tareWeights || []).reduce((s, w, i) => s + w * (boxQtys[i] || 1), 0);
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
  const qty = parseBoxQty(inp.value, 2);
  inp.value = qty;
  const st = pfStates[pi];
  if (!st) return;
  if (!st.saryQtys) st.saryQtys = Array(st.COLS).fill(2);
  st.saryQtys[col] = qty;
  updatePfRulonTotals(pi);
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
