'use strict';

const path = require('path');
const fs = require('fs');

let loadedFrom = null;

function applyParsedEnv(parsed) {
  if (!parsed) return;
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
}

function loadEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  applyParsedEnv(require('dotenv').parse(raw));
  loadedFrom = filePath;
  return filePath;
}

function loadEnv() {
  const candidates = [];
  const exeDir = path.dirname(process.execPath);
  candidates.push(path.join(exeDir, '.env'));
  candidates.push(path.join(process.cwd(), '.env'));
  if (!process.pkg) {
    candidates.push(path.join(__dirname, '../../.env'));
  }

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return loadEnvFile(p);
      }
    } catch (err) {
      console.warn('⚠ .env okap bolmady:', p, err.message);
    }
  }

  try {
    require('dotenv').config();
    loadedFrom = 'dotenv-default';
  } catch (_) { /* ignore */ }
  return null;
}

function getLoadedFrom() {
  return loadedFrom;
}

function getAppDir() {
  if (process.pkg) return path.dirname(process.execPath);
  return process.cwd();
}

if (!global.__YEDIDOGAN_ENV_LOADED__) {
  loadEnv();
  global.__YEDIDOGAN_ENV_LOADED__ = true;
}

module.exports = {
  loadEnv,
  getLoadedFrom,
  getAppDir,
};
