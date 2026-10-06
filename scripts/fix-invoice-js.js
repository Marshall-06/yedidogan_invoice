'use strict';

/**
 * invoice.js arassalaýar:
 * 1) diňe işjeň (komment däl) setirleri alyp galýar
 * 2) çap funksiýalaryny kommentden dikeldýär
 * 3) brutto = netto + tare (3 onluk) düzedýär
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const file = path.join(__dirname, '../js/invoice.js');
const raw = fs.readFileSync(file, 'utf8');
const lines = raw.split(/\r?\n/);

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//');
}

function uncomment(line) {
  // " // code" or "//code" or "// code"
  return line.replace(/^(\s*)\/\/\s?/, '$1');
}

// Keep only non-comment lines from the whole file first pass
const activeLines = [];
for (const line of lines) {
  if (isCommentLine(line)) continue;
  if (line.trim() === '') {
    // keep single blanks lightly
    if (activeLines.length && activeLines[activeLines.length - 1] !== '') activeLines.push('');
    continue;
  }
  activeLines.push(line);
}

let active = activeLines.join('\n');

// If print functions missing, pull from commented originals
const needPrint = !/\nfunction closePrintPreview\s*\(/.test(active)
  || !/\nfunction openPrint\s*\(/.test(active)
  || !/\nfunction buildPrintForma\s*\(/.test(active)
  || !/\nlet pfStates\b/.test(active);

if (needPrint) {
  const startMarker = '// /* ══════════════════════════════════════════════════════';
  const printStartHints = [
    '//    ÇAP FORMASY',
    '// let pfStates = null;',
  ];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('ÇAP FORMASY') && isCommentLine(lines[i])) {
      // walk back to pfStates or section header
      let j = i;
      while (j > 0 && !(lines[j].includes('let pfStates') || lines[j].includes('ÇAP FORMASY —'))) j--;
      // include from pfStates declaration block
      while (j > 0 && !lines[j].includes('let pfStates') && !lines[j].includes('════════════════════════════════')) j--;
      // prefer starting at `// let pfStates`
      for (let k = Math.max(0, i - 20); k <= i; k++) {
        if (lines[k].includes('let pfStates = null')) { j = k; break; }
      }
      start = j;
      break;
    }
  }
  if (start < 0) throw new Error('Commented print section not found');

  let end = -1;
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('function doPrint') ) {
      // include until closing brace line
      for (let k = i; k < Math.min(lines.length, i + 20); k++) {
        if (lines[k].trim() === '// }' || lines[k].trim() === '}') {
          end = k;
          break;
        }
      }
      break;
    }
  }
  if (end < 0) throw new Error('doPrint end not found');

  const printLines = [];
  for (let i = start; i <= end; i++) {
    const line = lines[i];
    if (!isCommentLine(line) && line.trim() !== '') continue;
    if (line.trim() === '') { printLines.push(''); continue; }
    printLines.push(uncomment(line));
  }
  active += '\n\n' + printLines.join('\n') + '\n';
}

// Ensure helpers at top after MODES
if (!/function round3\s*\(/.test(active)) {
  active = active.replace(
    /const MODES = \[[^\]]+\];/,
    (m) => `${m}

function round3(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 1000) / 1000;
}
function fmtWeight(n) {
  const x = round3(n);
  if (!x) return '0';
  return String(x);
}`
  );
}

// Brutto / tare behavior patches (idempotent-ish)
const patches = [
  // pickItem
  [
    /const tare = parseFloat\(it\.tare\) \|\| 0;\s*const brutto = \+it\.gram \|\| 0;\s*const net = Math\.max\(0, Math\.round\(brutto - tare\)\);/,
    `const tare = round3(parseFloat(it.tare) || 0);
  const brutto = round3(+it.gram || 0);
  // Brutto = netto + tare. Bazada gram brutto bolsa net = gram - tare.
  const net = brutto > 0 ? Math.max(0, round3(brutto - tare)) : 0;`
  ],
  // addRow
  [
    /function addRow\(p\) \{\s*const id = \+\+rid;\s*const tare = parseFloat\(p\?\.tare\) \|\| 0;\s*const gross = parseFloat\(p\?\.gross\) \|\| 0;\s*const net = p\?\.net != null \? \(parseFloat\(p\.net\) \|\| 0\) : Math\.max\(0, gross - tare\);/,
    `function addRow(p) {
  const id = ++rid;
  const tare = round3(parseFloat(p?.tare) || 0);
  const grossIn = round3(parseFloat(p?.gross) || 0);
  const net = p?.net != null ? round3(parseFloat(p.net) || 0) : Math.max(0, round3(grossIn - tare));`
  ],
  [
    /gross: net \+ tare,\s*self: p\?\.self \|\| '',/,
    `gross: round3(net + tare),
    self: p?.self || '',`
  ],
  // rowHTML
  [
    /function rowHTML\(id, n, p\) \{\s*const r = p \|\| \{\};\s*const tare = parseFloat\(r\.tare\) \|\| 0;\s*const gross = parseFloat\(r\.gross\) \|\| 0;\s*const net = r\.net != null \? \(parseFloat\(r\.net\) \|\| 0\) : Math\.max\(0, gross - tare\);\s*const brutto = net \+ tare;/,
    `function rowHTML(id, n, p) {
  const r = p || {};
  const tare = round3(parseFloat(r.tare) || 0);
  const gross = round3(parseFloat(r.gross) || 0);
  const net = r.net != null ? round3(parseFloat(r.net) || 0) : Math.max(0, round3(gross - tare));
  const brutto = round3(net + tare);`
  ],
  [
    /type="number" min="0" step="1" id="net-\$\{id\}"\s*value="\$\{net > 0 \? Math\.round\(net\) : ''\}"/,
    `type="number" min="0" step="any" id="net-\${id}"
        value="\${net > 0 ? fmtWeight(net) : ''}"`
  ],
  [
    /value="\$\{net > 0 \? Math\.round\(net\) : ''\}" placeholder="0"/,
    `value="\${net > 0 ? fmtWeight(net) : ''}" placeholder="0"`
  ],
  // onNetto
  [
    /function onNetto\(id, v\) \{\s*const r = rows\.get\(id\); if \(!r\) return;\s*r\.net = parseFloat\(v\) \|\| 0;/,
    `function onNetto(id, v) {
  const r = rows.get(id); if (!r) return;
  r.net = round3(parseFloat(String(v).replace(',', '.')) || 0);`
  ],
  // syncRowFromDom
  [
    /r\.net = parseFloat\(el\('net'\)\?\.value\) \|\| 0;\s*r\.gross = \(parseFloat\(r\.net\) \|\| 0\) \+ \(parseFloat\(r\.tare\) \|\| 0\);/,
    `r.net = round3(parseFloat(String(el('net')?.value || '').replace(',', '.')) || 0);
  r.gross = round3((parseFloat(r.net) || 0) + (parseFloat(r.tare) || 0));`
  ],
  // recalc + fg
  [
    /\/\* ══ RECALC: Brutto = Netto \+ Gilza\(Tare\) ══ \*\/\s*function recalc\(id\) \{\s*const r = rows\.get\(id\); if \(!r\) return;\s*r\.gross = \(parseFloat\(r\.net\) \|\| 0\) \+ \(parseFloat\(r\.tare\) \|\| 0\);\s*const el = document\.getElementById\('gross-' \+ id\);\s*if \(el\) el\.textContent = r\.gross > 0 \? fg\(r\.gross\) : '—';\s*totals\(\);\s*\}\s*\/\* Agram formatlaýjy[^*]*\*\/\s*function fg\(n\) \{ return String\(Math\.round\(Number\(n\) \|\| 0\)\); \}/,
    `/* ══ RECALC: Brutto = Netto + Gilza(Tare) ══ */
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
function fg(n) { return fmtWeight(n); }`
  ],
  // applyTareFromItem
  [
    /r\.tare = parseFloat\(it\.tare\) \|\| 0;/,
    'r.tare = round3(parseFloat(it.tare) || 0);'
  ],
  // fillRow tare/net
  [
    /if \(product\.tare != null && product\.tare !== ''\) r\.tare = \+product\.tare;/,
    "if (product.tare != null && product.tare !== '') r.tare = round3(+product.tare);"
  ],
  [
    /if \(nEl\) \{ nEl\.value = String\(Math\.round\(resNet\)\); r\.net = resNet; \}/,
    'if (nEl) { nEl.value = fmtWeight(resNet); r.net = round3(resNet); }'
  ],
  [
    /const tareVal = \(product\.tare\) \? \(\+product\.tare\) : \(r\.tare \|\| 0\);\s*const netVal = Math\.max\(0, \(\+product\.gram\) - tareVal\);\s*const nEl = document\.getElementById\('net-' \+ tid\);\s*if \(nEl && netVal > 0\) \{ nEl\.value = String\(Math\.round\(netVal\)\); r\.net = netVal; \}/,
    `const tareVal = product.tare != null && product.tare !== '' ? round3(+product.tare) : round3(r.tare || 0);
      r.tare = tareVal;
      const netVal = Math.max(0, round3((+product.gram) - tareVal));
      const nEl = document.getElementById('net-' + tid);
      if (nEl && netVal > 0) { nEl.value = fmtWeight(netVal); r.net = netVal; }`
  ],
  // loadInvoice
  [
    /const gross = parseFloat\(it\.gross\) \|\| 0;\s*const tare = parseFloat\(it\.tare\) \|\| 0;\s*const net = it\.net != null \? \(parseFloat\(it\.net\) \|\| 0\) : Math\.max\(0, gross - tare\);/,
    `const gross = round3(parseFloat(it.gross) || 0);
    const tare = round3(parseFloat(it.tare) || 0);
    const net = it.net != null ? round3(parseFloat(it.net) || 0) : Math.max(0, round3(gross - tare));`
  ],
  [
    /gross: net \+ tare,\s*self: it\.self \|\| '',/,
    `gross: round3(net + tare),
      self: it.self || '',`
  ],
  [
    /if \(bpNet\) bpNet\.textContent = res\.net > 0 \? Math\.round\(res\.net\) \+ ' gr\.' : '—';/,
    "if (bpNet) bpNet.textContent = res.net > 0 ? fmtWeight(res.net) + ' gr.' : '—';"
  ],
];

for (const [re, rep] of patches) {
  if (re.test(active)) active = active.replace(re, rep);
}

// Deduplicate function declarations: keep first occurrence of each top-level function
const outLines = active.split('\n');
const seen = new Set();
const deduped = [];
const fnRe = /^(async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/;
const letRe = /^let\s+([A-Za-z0-9_]+)\b/;
const constRe = /^const\s+([A-Za-z0-9_]+)\b/;

let skipUntilBrace = null;
let braceDepth = 0;
for (let i = 0; i < outLines.length; i++) {
  const line = outLines[i];
  if (skipUntilBrace != null) {
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }
    if (braceDepth <= 0) skipUntilBrace = null;
    continue;
  }

  const fm = line.match(fnRe);
  if (fm) {
    const name = fm[2];
    if (seen.has('fn:' + name)) {
      // skip this whole function
      braceDepth = 0;
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth > 0) skipUntilBrace = name;
      continue;
    }
    seen.add('fn:' + name);
  }
  const lm = line.match(letRe);
  if (lm) {
    const name = lm[1];
    if (seen.has('let:' + name) && (name === 'pfStates' || name === 'rid' || name === 'currentInvoiceId' || name === 'itemPickerTarget' || name === '_invoiceListCache')) {
      continue;
    }
    seen.add('let:' + name);
  }
  const cm = line.match(constRe);
  if (cm) {
    const name = cm[1];
    if (seen.has('const:' + name) && (name === 'MODES' || name === 'INV_GRID_COLS' || name === 'INV_GRID_ROWS' || name === 'INV_MAX_BLOCKS' || name === 'rows')) {
      continue;
    }
    seen.add('const:' + name);
  }
  deduped.push(line);
}

let out = deduped.join('\n').replace(/\n{3,}/g, '\n\n');
if (!out.startsWith("'use strict'") && !out.startsWith('"use strict"')) {
  out = "'use strict';\n\n" + out;
}

fs.writeFileSync(file, out, 'utf8');
execSync('node --check js/invoice.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

const has = (name) => new RegExp(`function ${name}\\s*\\(`).test(out);
console.log('bytes', out.length);
console.log('closePrintPreview', has('closePrintPreview'));
console.log('openPrint', has('openPrint'));
console.log('buildPrintForma', has('buildPrintForma'));
console.log('newInvoice', has('newInvoice'));
console.log('recalc', has('recalc'));
console.log('round3', has('round3'));
console.log('pfStates', /\blet pfStates\b/.test(out));
