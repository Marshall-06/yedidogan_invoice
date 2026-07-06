'use strict';

/* ══════════════════════════════════════════════════════
   API — backend (Node/Express) bilen aragatnaşyk
   Ähli HTTP çagyryşlary şu ýerden geçýär. JWT token
   localStorage-da saklanýar we awtomatiki goşulýar.
══════════════════════════════════════════════════════ */

// Backend adresi — gerek bolsa üýtget (meselem önümçilik domeni)
const API_BASE = 'http://localhost:4000/api';
const TOKEN_KEY = 'lz_token';

/* ── Token dolandyryş ── */
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

/* ── Esasy fetch örtügi ── */
async function apiRequest(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = 'Bearer ' + t;
  }

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Serwere birikip bolmady. Backend işleýärmi? (' + API_BASE + ')');
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* boş jogap */ }

  if (!res.ok) {
    const msg = (data && data.message) || ('Ýalňyşlyk ' + res.status);
    const err = new Error(msg);
    err.status = res.status;
    err.details = data && data.details;
    throw err;
  }

  return data ? data.data : null;
}

/* ── API endpointleri ── */
const API = {
  // Auth
  register: (b) => apiRequest('/auth/register', { method: 'POST', body: b }),
  login:    (b) => apiRequest('/auth/login',    { method: 'POST', body: b }),
  me:       ()  => apiRequest('/auth/me', { auth: true }),

  // Items
  items: {
    list:   (search) => apiRequest('/items' + (search ? '?search=' + encodeURIComponent(search) : '')),
    get:    (id)     => apiRequest('/items/' + id),
    create: (b)      => apiRequest('/items', { method: 'POST', body: b, auth: true }),
    update: (id, b)  => apiRequest('/items/' + id, { method: 'PUT', body: b, auth: true }),
    remove: (id)     => apiRequest('/items/' + id, { method: 'DELETE', auth: true }),
    import: (rows)   => apiRequest('/items/import', { method: 'POST', body: { rows }, auth: true }),
  },

  // Invoices
  invoices: {
    list:   ()  => apiRequest('/invoices', { auth: true }),
    get:    (id) => apiRequest('/invoices/' + id, { auth: true }),
    create: (b) => apiRequest('/invoices', { method: 'POST', body: b, auth: true }),
    update: (id, b) => apiRequest('/invoices/' + id, { method: 'PUT', body: b, auth: true }),
    patch:  (id, b) => apiRequest('/invoices/' + id, { method: 'PATCH', body: b, auth: true }),
    remove: (id) => apiRequest('/invoices/' + id, { method: 'DELETE', auth: true }),
  },

  // Users
  users: {
    list:   ()  => apiRequest('/users', { auth: true }),
    create: (b) => apiRequest('/users', { method: 'POST', body: b, auth: true }),
    remove: (id) => apiRequest('/users/' + id, { method: 'DELETE', auth: true }),
  },
};
