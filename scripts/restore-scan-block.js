'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const hist = path.join(
  process.env.APPDATA,
  'Cursor/User/History/-17a96352/enaj.js'
);
const file = path.join(__dirname, '../js/invoice.js');

const src = fs.readFileSync(hist, 'utf8').split(/\n/);
let start = -1;
let end = -1;
for (let i = 0; i < src.length; i++) {
  if (start < 0 && src[i].includes('async function apply(code)')) {
    start = i;
  }
  if (start >= 0 && src[i].trim() === '// })();') {
    end = i;
    break;
  }
}
if (start < 0 || end < 0) {
  throw new Error(`scan block not found start=${start} end=${end}`);
}

const block = src
  .slice(start, end)
  .map((l) => l.replace(/^(\s*)\/\/\s?/, '$1'))
  .join('\n');

let cur = fs.readFileSync(file, 'utf8');
if (cur.includes('async function apply(code)')) {
  console.log('apply already present — skip insert');
  process.exit(0);
}

const printAt = cur.indexOf('ÇAP FORMASY');
if (printAt < 0) throw new Error('print section missing');

const fillClose = cur.lastIndexOf('  }\n})();', printAt);
if (fillClose < 0) throw new Error('barcode IIFE end missing');

const insertAt = fillClose + 3; // after fillRow's closing brace
const out = `${cur.slice(0, insertAt)}\n\n${block}\n${cur.slice(insertAt)}`;
fs.writeFileSync(file, out, 'utf8');
execSync('node --check js/invoice.js', {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});
console.log('Inserted scan apply/listeners. bytes=', out.length);
