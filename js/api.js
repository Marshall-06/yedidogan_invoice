'use strict';

/* ══════════════════════════════════════════════════════
   API — backend (Node/Express) bilen aragatnaşyk
   Ähli HTTP çagyryşlary şu ýerden geçýär. JWT token
   localStorage-da saklanýar we awtomatiki goşulýar.
══════════════════════════════════════════════════════ */

const API_BASE = '/api';
const TOKEN_KEY = 'lz_token';

function isDbRepairableError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return (
    err.status === 400
    && /baza|fk|transaction|repair|yok say|aborted|invoice_items|constraint/i.test(msg)
  );
}

function formatApiError(data, status) {
  let msg = (data && data.message) || ('Ýalňyşlyk ' + status);
  if (data && data.details && data.details.length) {
    const extra = data.details.filter(Boolean).join(' — ');
    if (extra && !msg.includes(extra)) msg += ' (' + extra + ')';
  }
  return msg;
}

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function apiRequest(path, { method = 'GET', body, auth = false, withMeta = false } = {}) {
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
    const msg = formatApiError(data, res.status);
    const err = new Error(msg);
    err.status = res.status;
    err.details = data && data.details;
    throw err;
  }

  if (withMeta) return { data: data ? data.data : null, meta: data ? data.meta : null };
  return data ? data.data : null;
}

const API = {
  register: (b) => apiRequest('/auth/register', { method: 'POST', body: b }),
  login: (b) => apiRequest('/auth/login', { method: 'POST', body: b }),
  me: () => apiRequest('/auth/me', { auth: true }),

  items: {
    list: (search, { limit = 200, offset = 0 } = {}) => {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      qs.set('limit', String(limit));
      qs.set('offset', String(offset));
      return apiRequest('/items?' + qs.toString(), { withMeta: true });
    },
    lookup: (q) => apiRequest('/items/lookup?q=' + encodeURIComponent(q || '')),
    nextCode: () => apiRequest('/items/next-code'),
    get: (id) => apiRequest('/items/' + id),
    create: (b) => apiRequest('/items', { method: 'POST', body: b, auth: true }),
    update: (id, b) => apiRequest('/items/' + id, { method: 'PUT', body: b, auth: true }),
    remove: (id) => apiRequest('/items/' + id, { method: 'DELETE', auth: true }),
    import: (rows) => apiRequest('/items/import', { method: 'POST', body: { rows }, auth: true }),
  },

  invoices: {
    list: ({ limit = 50, offset = 0 } = {}) =>
      apiRequest('/invoices?limit=' + limit + '&offset=' + offset, { auth: true }),
    get: (id) => apiRequest('/invoices/' + id, { auth: true }),
    create: (b) => apiRequest('/invoices', { method: 'POST', body: b, auth: true }),
    update: (id, b) => apiRequest('/invoices/' + id, { method: 'PUT', body: b, auth: true }),
    patch: (id, b) => apiRequest('/invoices/' + id, { method: 'PATCH', body: b, auth: true }),
    remove: (id) => apiRequest('/invoices/' + id, { method: 'DELETE', auth: true }),
  },

  productionOrders: {
    list: ({ limit = 50, offset = 0, search = '' } = {}) => {
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (search) qs.set('search', search);
      return apiRequest('/production-orders?' + qs.toString(), { auth: true, withMeta: true });
    },
    meta: () => apiRequest('/production-orders/meta', { auth: true }),
    get: (id) => apiRequest('/production-orders/' + id, { auth: true }),
    create: (b) => apiRequest('/production-orders', { method: 'POST', body: b, auth: true }),
    update: (id, b) => apiRequest('/production-orders/' + id, { method: 'PUT', body: b, auth: true }),
    remove: (id) => apiRequest('/production-orders/' + id, { method: 'DELETE', auth: true }),
  },

  users: {
    list: () => apiRequest('/users', { auth: true }),
    create: (b) => apiRequest('/users', { method: 'POST', body: b, auth: true }),
    remove: (id) => apiRequest('/users/' + id, { method: 'DELETE', auth: true }),
  },

  repairDb: () => apiRequest('/repair-db', { method: 'POST', auth: true }),
};

/* Global — invoice.js, inventory.js we ş.m. ulanýar */
if (typeof window !== 'undefined') {
  window.API = API;
  window.getToken = getToken;
  window.setToken = setToken;
  window.clearToken = clearToken;
  window.isDbRepairableError = isDbRepairableError;
}
