'use strict';

/* ══════════════════════════════════════════════════════
   PRODUCTION ORDER — Önümçilik blanky (ZF)
   Renkden öň: elde. Renkden soň: default + üýtgedip bolýar.
   Müşderi / haryt: bazadan (datalist + items gözleg).
══════════════════════════════════════════════════════ */

let poCurrentId = null;
let poMeta = { musteriler: [], nextZfNo: '1', defaults: null };
let poEditorOpen = false;

function poEl(id) { return document.getElementById(id); }

function poToday() {
  return new Date().toISOString().slice(0, 10);
}

function setPoEditorVisible(show) {
  poEditorOpen = !!show;
  const ed = poEl('po-editor');
  const tools = poEl('po-editor-tools');
  if (ed) ed.style.display = show ? '' : 'none';
  if (tools) tools.style.display = show ? '' : 'none';
}

function poVal(id, v) {
  const el = poEl(id);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!v;
  else el.value = v != null ? v : '';
}

function poGet(id) {
  const el = poEl(id);
  if (!el) return '';
  if (el.type === 'checkbox') return el.checked;
  return el.value;
}

async function loadPoMeta() {
  try {
    poMeta = (await API.productionOrders.meta()) || poMeta;
  } catch (e) {
    poMeta = poMeta || { musteriler: [], nextZfNo: '1', defaults: null };
  }
  const dl = poEl('po-musteri-list');
  if (dl) {
    dl.innerHTML = (poMeta.musteriler || []).map(
      (m) => `<option value="${escapeHtml(m)}"></option>`
    ).join('');
  }
}

async function refreshPoIndex() {
  const wrap = poEl('po-index-list');
  if (!wrap) return;
  wrap.innerHTML = `<div class="inv-empty">Ýüklenýär…</div>`;
  const q = (poEl('po-search')?.value || '').trim();
  let res;
  try {
    res = await API.productionOrders.list({ limit: 50, offset: 0, search: q });
  } catch (e) {
    wrap.innerHTML = `<div class="inv-empty">Ýalňyşlyk: ${escapeHtml(e.message)}</div>`;
    return;
  }
  const list = Array.isArray(res) ? res : (res && res.data) || [];
  if (list.length === 0) {
    wrap.innerHTML = `<div class="inv-empty">Blank ýok — «Täze blank» basyň.</div>`;
    return;
  }
  wrap.innerHTML = list.map((row) => {
    const title = `ZF № ${escapeHtml(row.zfNo || '—')}`
      + (row.musteri ? ` · ${escapeHtml(row.musteri)}` : '')
      + (row.productName ? ` · ${escapeHtml(row.productName)}` : '');
    const sub = `${row.date || '—'} · ${escapeHtml(row.productCode || '')}`
      + (row.orderQty ? ` · ${escapeHtml(row.orderQty)}` : '');
    return `
      <div class="inv-index-item">
        <div class="inv-index-meta">
          <div class="inv-index-title">${title}${poCurrentId === row.id ? ' (açyk)' : ''}</div>
          <div class="inv-index-sub">${sub}</div>
        </div>
        <div class="inv-index-actions">
          <button class="btn btn-sm btn-edit" onclick="openProductionOrder(${row.id})">Aç</button>
          <button class="btn btn-sm btn-trash" onclick="deleteProductionOrder(${row.id})">Poz</button>
        </div>
      </div>`;
  }).join('');
}

const refreshPoIndexDebounced = typeof debounce === 'function'
  ? debounce(() => { refreshPoIndex(); }, 280)
  : () => { refreshPoIndex(); };

function clearPoForm() {
  poCurrentId = null;
  const d = (poMeta && poMeta.defaults) || {};
  const tech = d.tech || {};
  const after = d.afterColor || {};
  const colors = d.colors || [];

  poVal('po-zf', poMeta.nextZfNo || '');
  poVal('po-musteri', '');
  poVal('po-sargytsy', '');
  poVal('po-date', poToday());
  poVal('po-product-name', '');
  poVal('po-product-code', '');
  poVal('po-order-qty', '');
  poVal('po-deadline', '');
  poVal('po-job-name', '');

  [
    ['po-tech-lam-gyz', tech.laminasiyaGyzgynlyk],
    ['po-tech-wal-gyz', tech.walGyzgynlygy],
    ['po-tech-nokat', tech.nokatArasy || tech.walGalyynlygy],
    ['po-tech-ichki', tech.ichkiDiametr || tech.gilzaOlchegi],
    ['po-tech-dashky', tech.dashkyDiametr || tech.rulonDiametri],
    ['po-tech-ini', tech.ini || tech.polatSuzguc],
    ['po-tech-umumy', tech.umumyGalynlygy],
    ['po-tech-renk-sany', tech.renkSany || tech.goshundy],
    ['po-tech-foto', tech.fotoelement || 'REV'],
    ['po-tech-silindr', tech.silindrOlchegi || '537*1050'],
    ['po-tech-blade', tech.doctorBlade || tech.sekilUgry],
    ['po-tech-pecat', tech.pecatGornush || tech.pecatTarapy || 'ÜST'],
    ['po-tech-ugry', tech.silindrUgry || tech.sekilGornush || 'Ters'],
    ['po-tech-tub', tech.tubSany],
    ['po-tech-mt', tech.uzunlykMt || 'MAX'],
  ].forEach(([id, v]) => poVal(id, v || ''));

  for (let i = 0; i < 8; i++) {
    const c = colors[i] || {};
    poVal('po-c-name-' + i, c.name || '');
    poVal('po-c-ink-' + i, c.ink || '');
    poVal('po-c-vernik-' + i, c.vernik || '');
    poVal('po-c-visc-' + i, c.visc || '');
    poVal('po-c-start-' + i, c.start || '');
    poVal('po-c-finish-' + i, c.finish || '');
  }

  const gur = after.guratma || [];
  for (let i = 0; i < 8; i++) poVal('po-gur-' + i, gur[i] || '');
  const gurHi = after.guratmaHi || [];
  for (let i = 0; i < 8; i++) poVal('po-gurhi-' + i, gurHi[i] || '');

  poVal('po-speed-main', after.speedMain || '160');
  poVal('po-speed-alt', after.speedAlt || '100');
  poVal('po-start-tpsi', after.startTPsi || '32.31');
  poVal('po-finish-tpsi', after.finishTPsi || '29.23');
  poFillTimes(after.times, after);
  poVal('po-mat-1', after.material1 || '');
  poVal('po-mat-ratio', after.materialRatio || '38/1000');
  poVal('po-mat-2', after.material2 || '');
  poVal('po-mat-3', after.material3 || '');
  poVal('po-press-rolik', after.pressRolik || '1000');
  poVal('po-lamin-press', after.laminPress || '80000');
  poVal('po-kraska', after.kraskaKg || '');
  poVal('po-rastwor', after.rastworitelKg || '');
  poVal('po-kley', after.kleyKg || '');
  poVal('po-coldseal', after.coldSealKg || '');
  poVal('po-clishe', after.clisheSany || '');
  poVal('po-orient', after.orient || '');
  const pack = after.pack || {};
  poVal('po-pack-adaty', !!pack.adaty);
  poVal('po-pack-korobka', !!pack.korobka);
  poVal('po-pack-strec', !!pack.strec);
  poVal('po-pack-paddon', !!pack.paddon);

  for (let i = 0; i < 20; i++) poVal('po-pecat-' + i, '');
  for (let i = 0; i < 10; i++) {
    poVal('po-lam-' + i, '');
    poVal('po-kes-' + i, '');
  }
  poVal('po-upakowka', false);
}

function poFillTimes(times, after) {
  const t = times || {};
  const pecat = t.pecat || {};
  const lam = t.laminasiya || {};
  const kes = t.kesim || {};
  const up = t.upakowka || {};
  poVal('po-t-pecat-b', pecat.bashlan || after?.bashlanWagty || '');
  poVal('po-t-pecat-t', pecat.tayyarlyk || after?.tayyarlykWagty || '');
  poVal('po-t-pecat-d', pecat.dynan || after?.dynanWagty || '');
  poVal('po-t-lam-b', lam.bashlan || '');
  poVal('po-t-lam-t', lam.tayyarlyk || '');
  poVal('po-t-lam-d', lam.dynan || '');
  poVal('po-t-kes-b', kes.bashlan || '');
  poVal('po-t-kes-t', kes.tayyarlyk || '');
  poVal('po-t-kes-d', kes.dynan || '');
  poVal('po-t-up-b', up.bashlan || '');
  poVal('po-t-up-t', up.tayyarlyk || '');
  poVal('po-t-up-d', up.dynan || '');
}

function poCollectTimes() {
  return {
    pecat: {
      bashlan: poGet('po-t-pecat-b'),
      tayyarlyk: poGet('po-t-pecat-t'),
      dynan: poGet('po-t-pecat-d'),
    },
    laminasiya: {
      bashlan: poGet('po-t-lam-b'),
      tayyarlyk: poGet('po-t-lam-t'),
      dynan: poGet('po-t-lam-d'),
    },
    kesim: {
      bashlan: poGet('po-t-kes-b'),
      tayyarlyk: poGet('po-t-kes-t'),
      dynan: poGet('po-t-kes-d'),
    },
    upakowka: {
      bashlan: poGet('po-t-up-b'),
      tayyarlyk: poGet('po-t-up-t'),
      dynan: poGet('po-t-up-d'),
    },
  };
}

function fillPoForm(row) {
  poCurrentId = row.id;
  const p = row.payload || {};
  const tech = p.tech || {};
  const after = p.afterColor || {};
  const colors = p.colors || [];

  poVal('po-zf', row.zfNo || '');
  poVal('po-musteri', row.musteri || '');
  poVal('po-sargytsy', row.sargytsy || '');
  poVal('po-date', row.date || poToday());
  poVal('po-product-name', row.productName || '');
  poVal('po-product-code', row.productCode || '');
  poVal('po-order-qty', row.orderQty || '');
  poVal('po-deadline', row.deadline || '');
  poVal('po-job-name', row.jobName || '');

  [
    ['po-tech-lam-gyz', tech.laminasiyaGyzgynlyk],
    ['po-tech-wal-gyz', tech.walGyzgynlygy],
    ['po-tech-nokat', tech.nokatArasy || tech.walGalyynlygy],
    ['po-tech-ichki', tech.ichkiDiametr || tech.gilzaOlchegi],
    ['po-tech-dashky', tech.dashkyDiametr || tech.rulonDiametri],
    ['po-tech-ini', tech.ini || tech.polatSuzguc],
    ['po-tech-umumy', tech.umumyGalynlygy],
    ['po-tech-renk-sany', tech.renkSany || tech.goshundy],
    ['po-tech-foto', tech.fotoelement],
    ['po-tech-silindr', tech.silindrOlchegi],
    ['po-tech-blade', tech.doctorBlade || tech.sekilUgry],
    ['po-tech-pecat', tech.pecatGornush || tech.pecatTarapy],
    ['po-tech-ugry', tech.silindrUgry || tech.sekilGornush],
    ['po-tech-tub', tech.tubSany],
    ['po-tech-mt', tech.uzunlykMt],
  ].forEach(([id, v]) => poVal(id, v || ''));

  for (let i = 0; i < 8; i++) {
    const c = colors[i] || {};
    poVal('po-c-name-' + i, c.name || '');
    poVal('po-c-ink-' + i, c.ink || '');
    poVal('po-c-vernik-' + i, c.vernik || '');
    poVal('po-c-visc-' + i, c.visc || '');
    poVal('po-c-start-' + i, c.start || '');
    poVal('po-c-finish-' + i, c.finish || '');
  }

  const gur = after.guratma || [];
  for (let i = 0; i < 8; i++) poVal('po-gur-' + i, gur[i] || '');
  const gurHi = after.guratmaHi || [];
  for (let i = 0; i < 8; i++) poVal('po-gurhi-' + i, gurHi[i] || '');

  poVal('po-speed-main', after.speedMain || '');
  poVal('po-speed-alt', after.speedAlt || '');
  poVal('po-start-tpsi', after.startTPsi || '');
  poVal('po-finish-tpsi', after.finishTPsi || '');
  poFillTimes(after.times, after);
  poVal('po-mat-1', after.material1 || '');
  poVal('po-mat-ratio', after.materialRatio || '');
  poVal('po-mat-2', after.material2 || '');
  poVal('po-mat-3', after.material3 || '');
  poVal('po-press-rolik', after.pressRolik || '');
  poVal('po-lamin-press', after.laminPress || '');
  poVal('po-kraska', after.kraskaKg || '');
  poVal('po-rastwor', after.rastworitelKg || '');
  poVal('po-kley', after.kleyKg || '');
  poVal('po-coldseal', after.coldSealKg || '');
  poVal('po-clishe', after.clisheSany || '');
  poVal('po-orient', after.orient || '');
  const pack = after.pack || {};
  poVal('po-pack-adaty', !!pack.adaty);
  poVal('po-pack-korobka', !!pack.korobka);
  poVal('po-pack-strec', !!pack.strec);
  poVal('po-pack-paddon', !!pack.paddon);

  const pecat = p.pecat || [];
  const lam = p.laminasiya || [];
  const kes = p.kesim || [];
  for (let i = 0; i < 20; i++) poVal('po-pecat-' + i, pecat[i] || '');
  for (let i = 0; i < 10; i++) {
    poVal('po-lam-' + i, lam[i] || '');
    poVal('po-kes-' + i, kes[i] || '');
  }
  poVal('po-upakowka', !!p.upakowka);
}

function collectPoPayload() {
  const colors = [];
  for (let i = 0; i < 8; i++) {
    colors.push({
      n: i + 1,
      name: poGet('po-c-name-' + i),
      ink: poGet('po-c-ink-' + i),
      vernik: poGet('po-c-vernik-' + i),
      visc: poGet('po-c-visc-' + i),
      start: poGet('po-c-start-' + i),
      finish: poGet('po-c-finish-' + i),
    });
  }
  const guratma = [];
  const guratmaHi = [];
  for (let i = 0; i < 8; i++) {
    guratma.push(poGet('po-gur-' + i));
    guratmaHi.push(poGet('po-gurhi-' + i));
  }

  const pecat = [];
  for (let i = 0; i < 20; i++) pecat.push(poGet('po-pecat-' + i));
  const laminasiya = [];
  const kesim = [];
  for (let i = 0; i < 10; i++) {
    laminasiya.push(poGet('po-lam-' + i));
    kesim.push(poGet('po-kes-' + i));
  }

  const nokat = poGet('po-tech-nokat');
  const ichki = poGet('po-tech-ichki');
  const dashky = poGet('po-tech-dashky');
  const ini = poGet('po-tech-ini');
  const renkSany = poGet('po-tech-renk-sany');
  const blade = poGet('po-tech-blade');
  const pecatG = poGet('po-tech-pecat');
  const ugry = poGet('po-tech-ugry');

  return {
    tech: {
      laminasiyaGyzgynlyk: poGet('po-tech-lam-gyz'),
      walGyzgynlygy: poGet('po-tech-wal-gyz'),
      nokatArasy: nokat,
      ichkiDiametr: ichki,
      dashkyDiametr: dashky,
      ini,
      umumyGalynlygy: poGet('po-tech-umumy'),
      renkSany,
      fotoelement: poGet('po-tech-foto'),
      silindrOlchegi: poGet('po-tech-silindr'),
      doctorBlade: blade,
      pecatGornush: pecatG,
      silindrUgry: ugry,
      tubSany: poGet('po-tech-tub'),
      uzunlykMt: poGet('po-tech-mt'),
      walGalyynlygy: nokat,
      gilzaOlchegi: ichki,
      rulonDiametri: dashky,
      polatSuzguc: ini,
      goshundy: renkSany,
      sekilUgry: blade,
      pecatTarapy: pecatG,
      sekilGornush: ugry,
    },
    colors,
    afterColor: {
      guratma,
      guratmaHi,
      speedMain: poGet('po-speed-main'),
      speedAlt: poGet('po-speed-alt'),
      startTPsi: poGet('po-start-tpsi'),
      finishTPsi: poGet('po-finish-tpsi'),
      times: poCollectTimes(),
      bashlanWagty: poGet('po-t-pecat-b'),
      tayyarlykWagty: poGet('po-t-pecat-t'),
      dynanWagty: poGet('po-t-pecat-d'),
      material1: poGet('po-mat-1'),
      materialRatio: poGet('po-mat-ratio'),
      material2: poGet('po-mat-2'),
      material3: poGet('po-mat-3'),
      pressRolik: poGet('po-press-rolik'),
      laminPress: poGet('po-lamin-press'),
      kraskaKg: poGet('po-kraska'),
      rastworitelKg: poGet('po-rastwor'),
      kleyKg: poGet('po-kley'),
      coldSealKg: poGet('po-coldseal'),
      clisheSany: poGet('po-clishe'),
      orient: poGet('po-orient'),
      pack: {
        adaty: !!poGet('po-pack-adaty'),
        korobka: !!poGet('po-pack-korobka'),
        strec: !!poGet('po-pack-strec'),
        paddon: !!poGet('po-pack-paddon'),
      },
    },
    pecat,
    laminasiya,
    kesim,
    upakowka: poGet('po-upakowka'),
  };
}

function collectPoBody() {
  return {
    zfNo: poGet('po-zf'),
    musteri: poGet('po-musteri'),
    sargytsy: poGet('po-sargytsy'),
    date: poGet('po-date'),
    productName: poGet('po-product-name'),
    productCode: poGet('po-product-code'),
    orderQty: poGet('po-order-qty'),
    deadline: poGet('po-deadline'),
    jobName: poGet('po-job-name'),
    payload: collectPoPayload(),
  };
}

async function newProductionOrder() {
  await loadPoMeta();
  clearPoForm();
  setPoEditorVisible(true);
  const title = poEl('po-form-title');
  if (title) title.textContent = '＋ Täze önümçilik blanky';
  poEl('po-musteri')?.focus();
}

/** Work Order blankyndan — harytlar bazasyndan önüm saýla */
async function openPoItemPicker() {
  if (typeof isAdmin === 'function' && !isAdmin()) {
    alert('Diňe admin Work Order üçin haryt saýlap bilýär.');
    return;
  }
  if (!poEditorOpen) await newProductionOrder();
  if (typeof openItemPickerFor === 'function') {
    await openItemPickerFor('production');
  } else if (typeof openItemPicker === 'function') {
    await openItemPicker();
  }
}

/** Haryt bazasyndan Work Order aç — önüm maglumatlary geçýär */
async function openWorkOrderFromItem(itemId) {
  if (typeof isAdmin === 'function' && !isAdmin()) {
    alert('Diňe admin Work Order döredip bilýär.');
    return;
  }
  let it = typeof findItem === 'function' ? findItem(itemId) : null;
  if (!it) {
    try { it = await API.items.get(itemId); } catch (e) { /* ignore */ }
  }
  if (!it) {
    alert('Haryt tapylmady');
    return;
  }

  await loadPoMeta();
  clearPoForm();
  applyItemToWorkOrder(it, { keepDefaults: true });

  setPoEditorVisible(true);
  const title = poEl('po-form-title');
  if (title) title.textContent = '＋ WO · ' + (it.name || it.code || 'haryt');
  navigate('production');
  setTimeout(() => poEl('po-musteri')?.focus(), 80);
}

/** Saýlanan harydy blankyň «Kody / Önüm» meýdanlaryna goý (tech default üýtgemeýär) */
function applyItemToWorkOrder(it, opts) {
  if (!it) return;
  // «Kody» = harydyň ady (blankdaky ýaly «TESNE garpyz»)
  if (it.name) poVal('po-product-code', it.name);
  else if (it.code) poVal('po-product-code', it.code);

  // Önümiň ady boş bolsa — kod/PLU bilen doldur (elde üýtgedip bolýar)
  const nameEl = poEl('po-product-name');
  if (nameEl && !String(nameEl.value || '').trim()) {
    if (it.plu) poVal('po-product-name', it.plu);
    else if (it.code) poVal('po-product-name', it.code);
  }

  const title = poEl('po-form-title');
  if (title && !opts?.silentTitle) {
    const zf = poGet('po-zf');
    if (poCurrentId) title.textContent = '✎ ZF № ' + (zf || poCurrentId);
    else title.textContent = '＋ WO · ' + (it.name || it.code || 'haryt');
  }
}

async function openProductionOrder(id) {
  let row;
  try { row = await API.productionOrders.get(id); }
  catch (e) { alert('Ýalňyşlyk: ' + e.message); return; }
  fillPoForm(row);
  setPoEditorVisible(true);
  const title = poEl('po-form-title');
  if (title) title.textContent = '✎ ZF № ' + (row.zfNo || id);
  await refreshPoIndex();
}

async function saveProductionOrder() {
  const body = collectPoBody();
  if (!body.musteri && !body.productName && !body.zfNo) {
    alert('Iň bolmanda ZF №, müşderi ýa-da önümiň adyny giriziň!');
    return;
  }
  const b = poEl('po-btn-save');
  const o = b ? b.innerHTML : '';
  try {
    let saved;
    if (poCurrentId) {
      saved = await API.productionOrders.update(poCurrentId, body);
    } else {
      saved = await API.productionOrders.create(body);
      if (saved && saved.id) poCurrentId = saved.id;
    }
    if (b) {
      b.innerHTML = '✓ Saklandy';
      setTimeout(() => { b.innerHTML = o; }, 1600);
    }
    await loadPoMeta();
    await refreshPoIndex();
  } catch (e) {
    alert('Ýalňyşlyk: ' + e.message);
  }
}

async function deleteProductionOrder(id) {
  if (!confirm('Bu blanky pozmak isleýärsiňizmi?')) return;
  try {
    await API.productionOrders.remove(id);
    if (poCurrentId === id) {
      setPoEditorVisible(false);
      poCurrentId = null;
    }
    await refreshPoIndex();
  } catch (e) {
    alert('Ýalňyşlyk: ' + e.message);
  }
}

/* Haryt kodundan «Kody» meýdanyna harydyň adyny goý (kod özi däl) */
async function poLookupProduct() {
  const code = (poGet('po-product-code') || '').trim();
  if (!code || typeof lookupItemAsync !== 'function') return;
  const it = await lookupItemAsync(code);
  if (!it) return;
  if (it.name) poVal('po-product-code', it.name);
}

async function initProductionPage() {
  setPoEditorVisible(false);
  await loadPoMeta();
  await refreshPoIndex();
}

function poFmtDate(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1].slice(-2)}`;
  return iso;
}

function poPrintCell(v) {
  const s = (v == null || String(v).trim() === '') ? '&nbsp;' : escapeHtml(String(v));
  return s;
}

/* ══ ÇAP — suratdaky ZF blank (A4 portrait) ═════════════ */
function poFmtPress(v) {
  const s = String(v == null ? '' : v).replace(/\s/g, '');
  if (!s) return '';
  if (/^\d+$/.test(s) && s.length > 3) {
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  return s;
}

function poRollLine(v) {
  const s = (v == null || String(v).trim() === '') ? '' : escapeHtml(String(v));
  return `<span class="roll-line">${s}</span>`;
}

function poRollTable20(arr) {
  const list = Array.isArray(arr) ? arr : [];
  let html = '';
  for (let i = 0; i < 10; i++) {
    html += `<tr>
      <td class="num-col">${i + 1}</td><td>${poRollLine(list[i])}</td>
      <td class="num-col">${i + 11}</td><td>${poRollLine(list[i + 10])}</td>
    </tr>`;
  }
  return html;
}

function poRollTable10(arr) {
  const list = Array.isArray(arr) ? arr : [];
  let html = '';
  for (let i = 0; i < 10; i++) {
    html += `<tr><td class="num-col">${i + 1}</td><td>${poRollLine(list[i])}</td></tr>`;
  }
  return html;
}

/* TOP SECTION — suratdaky ýokarky bölek (müşderi → material → A4) */
function poPrintAsset(body, key, fallbackPath) {
  const a = body._printAssets || {};
  if (!a[key]) return fallbackPath;
  const isJpg = /\.jpe?g$/i.test(fallbackPath);
  return `data:image/${isJpg ? 'jpeg' : 'png'};base64,${a[key]}`;
}

async function poLoadPrintAssets() {
  const toB64 = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || '').split(',')[1] || '');
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  const load = (path) => fetch(path)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(path))))
    .then(toB64)
    .catch(() => '');
  const map = {
    logo: '/public/po/brand-logo.png',
    rev: '/public/po/rev-icon.png',
  };
  const pairs = await Promise.all(
    Object.entries(map).map(async ([k, p]) => [k, await load(p)])
  );
  return Object.fromEntries(pairs);
}

function buildProductionPrintHtml(body) {
  const p = body.payload || {};
  const t = p.tech || {};
  const a = p.afterColor || {};
  const colors = Array.from({ length: 8 }, (_, i) => (p.colors && p.colors[i]) || {});
  const gur = a.guratma || [];
  const gurHi = a.guratmaHi || [];
  const times = a.times || {};
  const pack = a.pack || {};
  const pecat = p.pecat || [];
  const lam = p.laminasiya || [];
  const kes = p.kesim || [];

  const nokat = t.nokatArasy || t.walGalyynlygy || '';
  const ichki = t.ichkiDiametr || t.gilzaOlchegi || '';
  const dashky = t.dashkyDiametr || t.rulonDiametri || '';
  const ini = t.ini || t.polatSuzguc || '';
  const umumy = t.umumyGalynlygy || '';
  const silindr = t.silindrOlchegi || '';
  const blade = t.doctorBlade || t.sekilUgry || '';
  const pecatG = t.pecatGornush || t.pecatTarapy || '';
  const ugry = t.silindrUgry || t.sekilGornush || '';
  const rev = t.fotoelement || 'REV';
  const renkSany = t.renkSany || t.goshundy || '';
  const orient = String(a.orient || '');
  const speedAlt = a.speedAlt || '100';
  const speedMain = a.speedMain || '160';

  const stageTime = (key) => {
    const s = times[key] || {};
    if (key === 'pecat' && !s.bashlan && !s.tayyarlyk && !s.dynan) {
      return {
        bashlan: a.bashlanWagty || '',
        tayyarlyk: a.tayyarlykWagty || '',
        dynan: a.dynanWagty || '',
      };
    }
    return s;
  };
  const tp = stageTime('pecat');
  const tl = stageTime('laminasiya');
  const tk = stageTime('kesim');
  const tu = stageTime('upakowka');
  const c = (i, key) => poPrintCell(colors[i][key]);
  const colorLabel = (i, fallback) => {
    const v = colors[i] && colors[i].name;
    return poPrintCell(v && String(v).trim() ? v : fallback);
  };
  const onOri = (n) => (orient === String(n) ? ' on' : '');
  const logoSrc = poPrintAsset(body, 'logo', '/public/po/brand-logo.png');
  const revSrc = poPrintAsset(body, 'rev', '/public/po/rev-icon.png');

  const handoverBlock = (teamName) => `
  <table class="handover tight">
    <colgroup>
      <col class="c-kontrol"/>
      <col class="c-body"/>
    </colgroup>
    <tr>
      <td class="kontrol-hdr">Kontrol</td>
      <td class="team-hdr">${escapeHtml(teamName)}</td>
    </tr>
    <tr>
      <td class="kontrol-box-cell" rowspan="4"><div class="kontrol-box"></div></td>
      <td class="blank"></td>
    </tr>
    <tr>
      <td class="lbl-kabul">Maglumaty kabul etdim</td>
    </tr>
    <tr>
      <td class="lbl-bellik">Bellik</td>
    </tr>
    <tr>
      <td class="lbl-tabs">Tabşyrdym</td>
    </tr>
  </table>`;

  let matRows = '';
  for (let i = 1; i <= 20; i += 1) {
    matRows += `<tr>
      <td class="rn">${i}</td>
      <td class="cell mg"></td><td class="cell mg"></td><td class="cell mg"></td><td class="cell mg"></td>
      <td class="cell mb"></td><td class="cell mb"></td><td class="cell mb"></td><td class="cell mb"></td>
      <td class="cell mp"></td>
    </tr>`;
  }

  const rollOriSvg = (deg) => `<svg class="ori-ico" viewBox="0 0 56 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="9" cy="18" rx="6.5" ry="13.5" fill="#eee" stroke="#333" stroke-width="1.5"/>
    <path d="M9 4.5 H45" fill="none" stroke="#333" stroke-width="1.5"/>
    <path d="M9 31.5 H45" fill="none" stroke="#333" stroke-width="1.5"/>
    <ellipse cx="45" cy="18" rx="6.5" ry="13.5" fill="#f7f7f7" stroke="#333" stroke-width="1.5"/>
    <path d="M13 11 H41 M13 18 H41 M13 25 H41" stroke="#c5c5c5" stroke-width="0.7"/>
    <g transform="rotate(${deg} 27 18)">
      <text x="27" y="22.5" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="15" font-weight="800" fill="#111">A</text>
    </g>
  </svg>`;

  return `<!DOCTYPE html>
<html lang="tk"><head><meta charset="UTF-8"/>
<title>ZF № ${escapeHtml(body.zfNo || '')}</title>
<style>
@page{size:A4 portrait;margin:7mm}
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:Arial,"Segoe UI",Helvetica,sans-serif;
  font-size:12px;color:#111;background:#fff;
  width:196mm;max-width:100%;margin:0 auto;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.sheet{width:100%;border:2px solid #000}
table{border-collapse:collapse;width:100%;table-layout:fixed}
td,th{border:1px solid #444;padding:2px 5px;vertical-align:middle;line-height:1.15}
.tight{margin-top:-1px}
.center{text-align:center}
.right{text-align:right}
.fw{font-weight:700}

/* surat / ZF_218 fontlar */
.headbar{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:2px solid #000}
.logo-img{height:14mm;width:auto;max-width:70%;display:block;object-fit:contain}
.zf{font-size:15px;white-space:nowrap}
.zf b{color:#1a6fd4;font-weight:600}
.zf .num{font-size:24px;font-weight:800;color:#111;margin-left:6px}
.lab{color:#333;font-style:italic;font-size:11px;white-space:nowrap}
.val{font-weight:700;font-family:"Segoe Print","Comic Sans MS",cursive;font-size:15px;color:#111}
.val.blue{color:#1a3d99}
.val.lg{font-size:16px}
.val.xl{font-size:22px;font-style:italic}

.peach{background:#f2d9bd}
.blue-tint{background:#cfe2ef}
.green-tint{background:#dcecc4}
.yellow-c{background:#fdf4bd}
.magenta-c{background:#f9d7e9}
.cyan-c{background:#cdeaf7}
.extra-c{background:#f2d9bd}
.black-c{background:#e4e4e4}
.pink-tint{background:#f3d6c2}
.dotbg{
  background-color:#dff3e6;
  background-image:radial-gradient(#9cc9ad .55px,transparent .55px);
  background-size:2.3px 2.3px;
}

.mid{display:grid;grid-template-columns:1.1fr .9fr;align-items:stretch}
.mid > div{min-width:0}
.fotosel{
  background:#d5f5e3;height:100%;min-height:19mm;padding:3px 6px;position:relative;
  display:flex;flex-direction:column;justify-content:flex-end;
}
.fotosel .flab{position:absolute;top:2px;left:6px;font-size:10px;font-style:italic;color:#333}
.fotosel .frow{display:flex;align-items:center;justify-content:space-between;gap:4px;padding-top:4px}
.rev-word{font-family:Georgia,"Times New Roman",serif;font-weight:800;font-size:26px;color:#2f7a3a;line-height:1}
.rev-img{height:13mm;width:auto;max-width:50%;display:block;object-fit:contain}
.tech .ini-lab{font-size:11px;font-weight:700;font-style:italic;text-align:right;padding-right:3px}
.tech .ini-val .val{font-size:18px}
.tech .sil-val .val{font-size:16px}
.mat-len{text-align:center;font-size:22px;font-weight:800;color:#1a3d99;font-style:italic;font-family:"Segoe Print","Comic Sans MS",cursive}
.press .blab{font-weight:700;font-style:italic;font-size:11px}
.gaplama{background:#cfe2ef;text-align:center;font-weight:700;font-size:11px;height:22px;line-height:20px;border:1px solid #444;border-top:0}

.a4row{display:grid;grid-template-columns:16% 1fr;border:1px solid #444;border-top:0}
.a4box{
  background:#c8e0c4;border-right:1px solid #444;min-height:18mm;
  display:grid;grid-template-columns:22% 18% 1fr;align-items:center;padding:3px 4px;
}
.a4vert{writing-mode:vertical-rl;transform:rotate(180deg);font-size:7px;font-weight:700;color:#2f7a3a;text-align:center;line-height:1.05}
.a4arr:before{
  content:"";display:block;width:0;height:0;margin:0 auto;
  border-left:4px solid transparent;border-right:4px solid transparent;border-top:11px solid #2f7a3a;
}
.a4txt{font-family:Georgia,"Times New Roman",serif;font-size:30px;font-weight:800;color:#2f7a3a;font-style:italic;text-align:center;line-height:1}
.oribox{display:flex;flex-direction:column}
.orients{display:grid;grid-template-columns:repeat(4,1fr);min-height:14mm}
.ori{border-right:1px solid #444;text-align:center;padding:3px 2px;display:flex;flex-direction:column;align-items:center;gap:2px}
.ori:last-child{border-right:0}
.ori.on{outline:2px solid #2f7a3a;outline-offset:-2px;background:#eaf7ef}
.ori-no{font-size:10px;font-weight:700}
.ori-ico{width:15mm;height:10mm;display:block}
.packbar{display:grid;grid-template-columns:1fr auto;border-top:1px solid #444;min-height:18px}
.packdots{background-color:#d0d0d0;background-image:radial-gradient(#888 .5px,transparent .5px);background-size:2.2px 2.2px}
.packopts{display:flex;align-items:center;gap:10px;padding:2px 8px;font-size:10px;font-style:italic;border-left:1px solid #444;background:#fff}
.packopts .on{font-weight:800}

.color th{background:#ececec;font-size:10px;text-align:center;font-weight:700}
.color td{text-align:center;height:20px}
.stage .st{background:#dcecc4;font-weight:700;text-align:center;font-size:11px}
.stage td{height:20px}

.top-grid{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:0;border-top:1px solid #444}
.rbox{border-right:1px solid #444;min-height:48mm}
.rbox:last-child{border-right:0}
h3.sect{margin:0;padding:3px 4px;font-size:12px;font-weight:700;border-bottom:1px solid #444;text-align:center}
.num-col{width:22px;text-align:center;font-weight:700;border:none!important;padding:1px 2px!important}
.roll-line{border:none;border-bottom:1px solid #333;display:inline-block;width:100%;height:14px;font-size:12px;font-weight:700;font-family:"Segoe Print","Comic Sans MS",cursive}
.roll-table td{padding:1px 4px;border:none}

/* —— 2-nji sahypa (surat — handover + material) —— */
.sheet2{page-break-before:always;margin-top:0;padding:4mm 3mm 3mm;border:2px solid #000}
.p2-title{
  display:inline-block;background:#d9ead3;color:#1a3d1a;font-weight:800;font-size:12px;
  padding:3px 10px;border:1px solid #333;border-bottom:0;min-width:44mm;
}
.p2-handover-wrap{border:1px solid #333;border-top:0}
.handover{width:100%;margin:0;border-top:2px solid #333}
.handover:first-child{border-top:0}
.handover td,.handover th{border:1px solid #888;padding:0;vertical-align:middle;font-size:10px}
.handover .c-kontrol{width:14mm}
.handover .c-body{width:auto}
.handover .kontrol-hdr{
  background:#d9ead3;color:#222;font-weight:700;font-size:10px;
  text-align:center;padding:3px 2px;border-right:1px solid #333;
}
.handover .team-hdr{
  background:#d9ead3;color:#800040;font-weight:800;font-size:11px;
  padding:3px 8px;white-space:nowrap;
}
.handover .kontrol-box-cell{
  text-align:center;vertical-align:middle;padding:4px 2px!important;
  background:#fff;border-right:1px solid #333;
}
.kontrol-box{
  border:1.5px dashed #888;width:10mm;height:10mm;margin:0 auto;background:#fff;display:block;
}
.handover .blank{height:18px;background:#fff;border-bottom:1px solid #888}
.handover .lbl-kabul{
  color:#800040;font-style:italic;font-size:10px;padding:3px 8px;height:18px;
  border-bottom:1px solid #888;
}
.handover .lbl-bellik{
  color:#777;font-style:italic;font-size:10px;padding:3px 8px;height:18px;
  border-bottom:1px solid #888;
}
.handover .lbl-tabs{
  color:#111;font-weight:700;font-size:10px;padding:3px 8px;height:18px;
}
.mat2{width:100%;margin-top:5mm;border:2px solid #000;border-collapse:collapse;table-layout:fixed}
.mat2 th,.mat2 td{border:1px solid #000;padding:0;vertical-align:middle}
.mat2 th{font-size:9px;font-weight:700;text-align:center;height:15px}
.mat2 .mg{background:#d9ead3}
.mat2 .mb{background:#cfe2f3}
.mat2 .mp{background:#f4cccc}
.mat2 .rn{width:7mm;text-align:center;font-weight:700;font-size:9px;height:14px;background:#fff}
.mat2 .cell{height:14px;background:#fff}

@media print{
  html,body{width:210mm}
  .sheet,.sheet2{border:2px solid #000}
  .sheet{page-break-after:always}
  .sheet2{page-break-before:always}
}
</style></head><body>
<div class="sheet">

  <div class="headbar">
    <img class="logo-img" src="${logoSrc}" alt="ÝEDIDOGAN NUR"/>
    <div class="zf"><b>ZF №</b><span class="num">${poPrintCell(body.zfNo)}</span></div>
  </div>

  <table>
    <tr>
      <td class="lab" style="width:12%">Müşderi:</td>
      <td class="val lg" style="width:38%">${poPrintCell(body.musteri)}</td>
      <td class="lab" style="width:14%">Senesi:</td>
      <td class="val" style="width:36%">${poPrintCell(poFmtDate(body.date))}</td>
    </tr>
    <tr>
      <td class="lab">Salgysy:</td>
      <td class="val">${poPrintCell(body.sargytsy)}</td>
      <td class="lab">Önüm ady:</td>
      <td class="val">${poPrintCell(body.productName)}</td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td class="lab">Kody:</td>
      <td class="val blue lg">${poPrintCell(body.productCode)}</td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td class="lab">Sargyt mukdary:</td>
      <td class="val blue">${poPrintCell(body.orderQty)}</td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td class="lab">Tabşyrma möhleti:</td>
      <td class="val">${poPrintCell(body.deadline)}</td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td class="lab">Işiň ady:</td>
      <td class="val">${poPrintCell(body.jobName)}</td>
    </tr>
  </table>

  <div class="mid tight">
    <div style="border-right:1px solid #444">
      <table>
        <tr>
          <td class="peach lab fw center" rowspan="2" style="width:30%;font-size:10px;line-height:1.15">Laminasiýa<br>gyzgynlyk</td>
          <td class="peach center" style="width:18%;height:18px">${poPrintCell(t.laminasiyaGyzgynlyk)}</td>
          <td class="peach" style="width:18%"></td>
          <td rowspan="3" style="width:34%;padding:0;vertical-align:stretch">
            <div class="fotosel">
              <div class="flab">Fotosel</div>
              <div class="frow">
                <div class="rev-word">${poPrintCell(rev)}</div>
                <img class="rev-img" src="${revSrc}" alt=""/>
              </div>
            </div>
          </td>
        </tr>
        <tr><td class="peach"></td><td class="peach"></td></tr>
        <tr>
          <td class="blue-tint lab fw" colspan="2" style="font-size:10px">Wal gyzgynlygy</td>
          <td class="blue-tint val blue center">${poPrintCell(t.walGyzgynlygy)}</td>
        </tr>
      </table>
      <table class="tech tight">
        <tr>
          <td class="lab" style="width:32%">fotosel arasy</td>
          <td class="val center" style="width:16%">${poPrintCell(nokat)}</td>
          <td class="lab" style="width:28%">Silindr ölçegi</td>
          <td class="center sil-val" style="width:24%"><span class="val">${poPrintCell(silindr)}</span></td>
        </tr>
        <tr>
          <td class="lab">Rulon iç diametri</td>
          <td class="val center">${poPrintCell(ichki)}</td>
          <td class="lab">Dr.Blade ini</td>
          <td class="val center">${poPrintCell(blade)}</td>
        </tr>
        <tr>
          <td class="lab">Rul. daş diametri</td>
          <td class="val center">${poPrintCell(dashky)}</td>
          <td class="lab">Peçat görnüşi</td>
          <td class="val center">${poPrintCell(pecatG)}</td>
        </tr>
        <tr>
          <td class="ini-lab">ini</td>
          <td class="center ini-val"><span class="val">${poPrintCell(ini)}</span></td>
          <td class="lab">Silindr ugry</td>
          <td class="val center">${poPrintCell(ugry)}</td>
        </tr>
        <tr>
          <td class="lab">Umumy galyňlygy</td>
          <td class="val center">${poPrintCell(umumy)}</td>
          <td class="lab right">Tub sany</td>
          <td class="val center">${poPrintCell(t.tubSany)}</td>
        </tr>
        <tr>
          <td class="lab">Reňk sany</td>
          <td class="val center">${poPrintCell(renkSany)}</td>
          <td class="lab right">Uzynlygy, MT</td>
          <td class="val center">${poPrintCell(t.uzunlykMt)}</td>
        </tr>
      </table>
    </div>
    <div>
      <table>
        <tr>
          <th class="blue-tint center" style="width:8%;font-size:10px">№</th>
          <th class="blue-tint center" style="width:44%;font-size:10px">Material</th>
          <th class="blue-tint center" style="width:22%;font-size:10px">Mikron/MM</th>
          <th class="blue-tint center" style="width:26%;font-size:10px">Uzynlyk, Mt</th>
        </tr>
        <tr>
          <td class="center fw">1</td>
          <td class="val blue">${poPrintCell(a.material1)}</td>
          <td class="val blue center">${poPrintCell(a.materialRatio)}</td>
          <td class="mat-len" rowspan="3">${poPrintCell(poFmtPress(a.laminPress))}</td>
        </tr>
        <tr>
          <td class="center fw dotbg">2</td>
          <td class="dotbg val blue">${poPrintCell(a.material2)}</td>
          <td class="dotbg"></td>
        </tr>
        <tr>
          <td class="center fw dotbg">3</td>
          <td class="dotbg val blue">${poPrintCell(a.material3)}</td>
          <td class="dotbg"></td>
        </tr>
      </table>
      <table class="press tight">
        <tr>
          <td class="blab" style="width:26%">Press rolik</td>
          <td class="val blue lg" style="width:24%">${poPrintCell(a.pressRolik)}</td>
          <td class="blab" style="width:28%">Lamin. press</td>
          <td style="width:22%"></td>
        </tr>
        <tr>
          <td class="lab">Kraska, kg</td>
          <td class="val">${poPrintCell(a.kraskaKg)}</td>
          <td class="lab">Rastworitel, kg</td>
          <td class="val">${poPrintCell(a.rastworitelKg)}</td>
        </tr>
        <tr>
          <td class="lab">Kleý, kg</td>
          <td class="val">${poPrintCell(a.kleyKg)}</td>
          <td class="lab">Cold Seal, kg</td>
          <td class="val">${poPrintCell(a.coldSealKg)}</td>
        </tr>
      </table>
      <div class="gaplama">Gaplama</div>
    </div>
  </div>

  <div class="a4row">
    <div class="a4box">
      <div class="a4vert">Rulon akys ugry</div>
      <div class="a4arr" aria-hidden="true"></div>
      <div class="a4txt">A4</div>
    </div>
    <div class="oribox">
      <div class="orients">
        <div class="ori${onOri(1)}"><div class="ori-no">№1</div>${rollOriSvg(0)}</div>
        <div class="ori${onOri(2)}"><div class="ori-no">№2</div>${rollOriSvg(180)}</div>
        <div class="ori${onOri(3)}"><div class="ori-no">№3</div>${rollOriSvg(90)}</div>
        <div class="ori${onOri(4)}"><div class="ori-no">№4</div>${rollOriSvg(-90)}</div>
      </div>
      <div class="packbar">
        <div class="packdots"></div>
        <div class="packopts">
          <span class="${pack.adaty ? 'on' : ''}">${pack.adaty ? '☑' : '☐'} Adaty</span>
          <span class="${pack.korobka ? 'on' : ''}">${pack.korobka ? '☑' : '☐'} Korobka</span>
          <span class="${pack.strec ? 'on' : ''}">${pack.strec ? '☑' : '☐'} Streç</span>
          <span class="${pack.paddon ? 'on' : ''}">${pack.paddon ? '☑' : '☐'} Paddon</span>
        </div>
      </div>
    </div>
  </div>

  <table class="color tight">
    <tr>
      <th style="width:10%"></th>
      <th style="width:11%">1</th><th style="width:11%">2</th><th style="width:11%">3</th>
      <th class="yellow-c" style="width:11%">4</th><th class="magenta-c" style="width:11%">5</th>
      <th class="cyan-c" style="width:11%">6</th><th class="extra-c" style="width:11%">7</th>
      <th class="black-c" style="width:12%">8</th>
    </tr>
    <tr>
      <td class="lab" style="text-align:left">Color</td>
      <td>${c(0,'name')}</td><td>${c(1,'name')}</td><td>${c(2,'name')}</td>
      <td class="yellow-c fw">${colorLabel(3, 'YELLOW')}</td>
      <td class="magenta-c fw">${colorLabel(4, 'MAGENTA')}</td>
      <td class="cyan-c fw">${colorLabel(5, 'CYAN')}</td>
      <td class="extra-c fw">${colorLabel(6, 'EXTRA')}</td>
      <td class="black-c fw">${colorLabel(7, 'BLACK')}</td>
    </tr>
    <tr>
      <td class="lab" style="text-align:left">INK</td>
      <td>${c(0,'ink')}</td><td>${c(1,'ink')}</td><td>${c(2,'ink')}</td>
      <td class="yellow-c">${c(3,'ink')}</td><td class="magenta-c">${c(4,'ink')}</td>
      <td class="cyan-c">${c(5,'ink')}</td><td class="extra-c">${c(6,'ink')}</td><td class="black-c">${c(7,'ink')}</td>
    </tr>
    <tr>
      <td class="lab" style="text-align:left">Vernik</td>
      <td>${c(0,'vernik')}</td><td>${c(1,'vernik')}</td><td>${c(2,'vernik')}</td>
      <td class="yellow-c">${c(3,'vernik')}</td><td class="magenta-c">${c(4,'vernik')}</td>
      <td class="cyan-c">${c(5,'vernik')}</td><td class="extra-c">${c(6,'vernik')}</td><td class="black-c">${c(7,'vernik')}</td>
    </tr>
    <tr>
      <td class="lab" style="text-align:left">Viscosity</td>
      <td>${c(0,'visc')}</td><td>${c(1,'visc')}</td><td>${c(2,'visc')}</td>
      <td class="yellow-c">${c(3,'visc')}</td><td class="magenta-c">${c(4,'visc')}</td>
      <td class="cyan-c">${c(5,'visc')}</td><td class="extra-c">${c(6,'visc')}</td><td class="black-c">${c(7,'visc')}</td>
    </tr>
  </table>

  <table class="tight">
    <tr>
      <td class="lab pink-tint" style="width:14%">Start T, PSI</td>
      <td class="val blue pink-tint" style="width:10%">${poPrintCell(a.startTPsi)}</td>
      <td class="pink-tint fw center" colspan="5">Guratma temperatura</td>
    </tr>
    <tr>
      <td class="lab pink-tint">Finish T, PSI</td>
      <td class="val blue pink-tint">${poPrintCell(a.finishTPsi)}</td>
      <td class="yellow-c center lab">4</td><td class="magenta-c center lab">5</td>
      <td class="cyan-c center lab">6</td><td class="extra-c center lab">7</td><td class="black-c center lab">8</td>
    </tr>
    <tr>
      <td class="lab" colspan="2">${escapeHtml(String(speedAlt))}m/min</td>
      <td class="yellow-c center val">${poPrintCell(gur[3])}</td><td class="magenta-c center val">${poPrintCell(gur[4])}</td>
      <td class="cyan-c center val">${poPrintCell(gur[5])}</td><td class="extra-c center val">${poPrintCell(gur[6])}</td>
      <td class="black-c center val">${poPrintCell(gur[7])}</td>
    </tr>
    <tr>
      <td class="lab" colspan="2">${escapeHtml(String(speedMain))}m/min</td>
      <td class="yellow-c center val">${poPrintCell(gurHi[3])}</td><td class="magenta-c center val">${poPrintCell(gurHi[4])}</td>
      <td class="cyan-c center val">${poPrintCell(gurHi[5])}</td><td class="extra-c center val">${poPrintCell(gurHi[6])}</td>
      <td class="black-c center val">${poPrintCell(gurHi[7])}</td>
    </tr>
  </table>

  <table class="stage tight">
    <tr>
      <td class="st green-tint" style="width:16%"></td>
      <td class="st green-tint">Başlan wagty</td>
      <td class="st green-tint">Taýýarlyk wagty</td>
      <td class="st green-tint">Dynan wagty</td>
    </tr>
    <tr><td class="lab">Peçat</td><td class="center val">${poPrintCell(tp.bashlan)}</td><td class="center val">${poPrintCell(tp.tayyarlyk)}</td><td class="center val">${poPrintCell(tp.dynan)}</td></tr>
    <tr><td class="lab">Laminasiýa</td><td class="center val">${poPrintCell(tl.bashlan)}</td><td class="center val">${poPrintCell(tl.tayyarlyk)}</td><td class="center val">${poPrintCell(tl.dynan)}</td></tr>
    <tr><td class="lab">Kesim</td><td class="center val">${poPrintCell(tk.bashlan)}</td><td class="center val">${poPrintCell(tk.tayyarlyk)}</td><td class="center val">${poPrintCell(tk.dynan)}</td></tr>
    <tr><td class="lab">Upakowka</td><td class="center val">${poPrintCell(tu.bashlan)}</td><td class="center val">${poPrintCell(tu.tayyarlyk)}</td><td class="center val">${poPrintCell(tu.dynan)}</td></tr>
  </table>

  <div class="top-grid">
    <div class="rbox">
      <h3 class="sect blue-tint">Çap edilen rulon sanawy</h3>
      <div style="padding:0 6px 6px"><table class="roll-table">${poRollTable20(pecat)}</table></div>
    </div>
    <div class="rbox">
      <h3 class="sect green-tint">Laminasiýa edilen rulon sanawy</h3>
      <div style="padding:0 6px 6px"><table class="roll-table">${poRollTable10(lam)}</table></div>
    </div>
    <div class="rbox">
      <h3 class="sect green-tint">Kesilen rulon sanawy <span style="font-size:10px;float:right;font-weight:400">Nusga</span></h3>
      <div style="padding:0 6px 6px"><table class="roll-table">${poRollTable10(kes)}</table></div>
    </div>
  </div>

</div>

<!-- 2-nji sahypa: Tabşyryş/Kabul ediş -->
<div class="sheet sheet2">
  <div class="p2-title">Tabşyryş/Kabul ediş</div>
  <div class="p2-handover-wrap">
    ${handoverBlock('Çap ediş topary')}
    ${handoverBlock('Laminirleme topary')}
    ${handoverBlock('Kesim topary')}
    ${handoverBlock('Upakowka/sarym topary')}
  </div>

  <table class="mat2 tight">
    <tr>
      <th class="rn" rowspan="2"></th>
      <th class="mg" colspan="4">Çykarylan material</th>
      <th class="mb" colspan="4">Wozwrat edilen</th>
      <th class="mp" rowspan="2">Othot</th>
    </tr>
    <tr>
      <th class="mg"></th><th class="mg"></th><th class="mg"></th><th class="mg"></th>
      <th class="mb"></th><th class="mb"></th><th class="mb"></th><th class="mb"></th>
    </tr>
    ${matRows}
  </table>
</div>

</body></html>`;
}

function printProductionOrder() {
  if (!poEditorOpen) {
    alert('Ilki blanky açyň ýa-da täze dörediň!');
    return;
  }
  const body = collectPoBody();
  const finishPrint = (html) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0'
    });
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = win.document;
    doc.open();
    doc.write(html);
    doc.close();
    const cleanup = () => {
      win.removeEventListener('afterprint', cleanup);
      setTimeout(() => { try { iframe.remove(); } catch (e) { /* ignore */ } }, 400);
    };
    win.addEventListener('afterprint', cleanup);
    const imgs = Array.from(doc.images || []);
    const ready = imgs.length
      ? Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => {
        img.onload = img.onerror = () => res();
      }))))
      : Promise.resolve();
    ready.then(() => {
      setTimeout(() => {
        try { win.focus(); win.print(); }
        catch (e) { cleanup(); alert('Çap açylmady: ' + e.message); }
      }, 120);
    });
  };

  poLoadPrintAssets().then((assets) => {
    body._printAssets = assets;
    finishPrint(buildProductionPrintHtml(body));
  });
}
