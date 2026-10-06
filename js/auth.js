'use strict';

/* ══════════════════════════════════════════════════════
   AUTH — ulanyjy girişi we rollar (backend API esasly)
   ────────────────────────────────────────────────────
   JWT token localStorage-da (api.js arkaly) saklanýar.
   Rollar:
     admin → hemme zat (haryt CRUD, faktura, ulanyjy dolandyryş)
     user  → diňe harytlary görmek
   Ilkinji registrasiýa eden ulanyjy awtomatiki admin bolýar.
══════════════════════════════════════════════════════ */

// Häzirki giren ulanyjy (serwerden) — sinhron barlaglar üçin keş
let CURRENT_USER = null;

function currentUser(){ return CURRENT_USER; }
function isAdmin(){ return !!CURRENT_USER && CURRENT_USER.role === 'admin'; }

/* ══ LOGIN / REGISTER MODAL ═════════════════════════════ */
let authMode = 'login';   // 'login' | 'register'

/* Rejimi çalşýar — login-de at soralmaýar, registrasiýada soralýar */
function setAuthMode(mode){
  authMode = (mode === 'register') ? 'register' : 'login';
  const isReg = authMode === 'register';

  document.getElementById('reg-name-row').style.display = isReg ? '' : 'none';
  document.getElementById('login-title').textContent = isReg ? 'Hasaba alyş' : 'Giriş';
  document.getElementById('auth-submit').textContent = isReg ? '＋ Hasap döret' : 'Gir →';
  document.getElementById('tab-login').classList.toggle('active', !isReg);
  document.getElementById('tab-register').classList.toggle('active', isReg);
  document.getElementById('login-error').textContent = '';
}

/* Submit düwmesi — rejime görä login ýa-da register */
function submitAuth(){
  if(authMode === 'register') doRegister();
  else doLogin();
}

function openLogin(){
  // Her açylanda meýdanlar boş gelýär (öňki maglumat galmaýar)
  document.getElementById('login-email').value = '';
  document.getElementById('login-name').value  = '';
  document.getElementById('login-code').value  = '';
  resetLoginCodeVisibility();
  setAuthMode('login');
  document.getElementById('login-modal').classList.add('open');
  setTimeout(()=>{ const e=document.getElementById('login-email'); if(e) e.focus(); }, 50);
}
function closeLogin(){
  document.getElementById('login-modal').classList.remove('open');
}

/* ══ GIRIŞ ══════════════════════════════════════════════ */
async function doLogin(){
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const code  = document.getElementById('login-code').value;
  const err   = document.getElementById('login-error');
  err.textContent = '';

  if(!email || !code){ err.textContent = 'Email we kod giriziň.'; return; }

  try{
    const { token, user } = await API.login({ email, code });
    setToken(token);
    CURRENT_USER = user;
  }catch(e){
    err.textContent = e.message || 'Giriş başartmady.';
    return;
  }

  document.getElementById('login-code').value = '';
  closeLogin();
  if(isAdmin()) enterAdmin();
  else setGuestMode();
}

/* ══ REGISTRASIÝA — öz hasabyňy döretmek ════════════════
   Boş bazada ilkinji ulanyjy serwerde admin bolýar.
══════════════════════════════════════════════════════ */
async function doRegister(){
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const name  = document.getElementById('login-name').value.trim();
  const code  = document.getElementById('login-code').value;
  const err   = document.getElementById('login-error');
  err.textContent = '';

  if(!email || !code){ err.textContent = 'Email we kod giriziň.'; return; }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ err.textContent = 'Email nädogry görnüşde.'; return; }

  try{
    const { token, user } = await API.register({ email, name, code });
    setToken(token);
    CURRENT_USER = user;
  }catch(e){
    err.textContent = e.message || 'Registrasiýa başartmady.';
    return;
  }

  document.getElementById('login-code').value = '';
  closeLogin();
  if(isAdmin()) enterAdmin();
  else setGuestMode();
}

function logout(){
  clearToken();
  CURRENT_USER = null;
  setGuestMode();
}

/* ══ REJIMLER ═══════════════════════════════════════════
   Guest  → login etmezden hem harytlar görünýär (diňe okamak)
   Admin  → sidebar-ly admin panel, hemme rugsat
══════════════════════════════════════════════════════ */
function setGuestMode(){
  document.body.classList.remove('mode-admin');
  document.body.classList.add('mode-guest');

  const area = document.getElementById('guest-auth');
  if(area){
    if(CURRENT_USER){
      area.innerHTML =
        `<span class="guest-user">${escapeHtml(CURRENT_USER.name || CURRENT_USER.email)}</span>` +
        `<button class="btn btn-ghost btn-sm" onclick="logout()">Çyk</button>`;
    } else {
      area.innerHTML = `<button class="btn btn-add" onclick="openLogin()">🔑 Admin Giriş</button>`;
    }
  }
  navigate('inventory');
}

function enterAdmin(){
  if(!isAdmin()){ setGuestMode(); return; }

  document.body.classList.remove('mode-guest');
  document.body.classList.add('mode-admin');
  document.getElementById('sb-user-name').textContent = (CURRENT_USER.name || CURRENT_USER.email);

  renderUsers();
  navigate('inventory');
}

/* ══ ULANYJY DOLANDYRYŞ (diňe admin) ════════════════════ */
async function submitUserForm(){
  const email = document.getElementById('uf-email').value.trim().toLowerCase();
  const name  = document.getElementById('uf-name').value.trim();
  const code  = document.getElementById('uf-code').value.trim();
  const role  = document.getElementById('uf-role').value;

  if(!email || !code){ alert('Email we kod giriziň!'); return; }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ alert('Email nädogry görnüşde!'); return; }

  try{
    await API.users.create({ email, name, code, role });
  }catch(e){
    alert('Ýalňyşlyk: ' + e.message);
    return;
  }

  document.getElementById('uf-email').value = '';
  document.getElementById('uf-name').value  = '';
  document.getElementById('uf-code').value  = '';
  document.getElementById('uf-role').value  = 'user';
  renderUsers();
}

async function removeUser(id){
  if(!confirm('Bu ulanyjyny pozmaly my?')) return;
  try{
    await API.users.remove(id);
  }catch(e){
    alert('Ýalňyşlyk: ' + e.message);
    return;
  }
  renderUsers();
}

async function renderUsers(){
  const tb = document.getElementById('user-tbody');
  if(!tb) return;

  let users = [];
  try{ users = (await API.users.list()) || []; }
  catch(e){
    tb.innerHTML = `<tr><td colspan="6" class="inv-empty">Ulanyjylar ýüklenmedi: ${escapeHtml(e.message)}</td></tr>`;
    document.getElementById('user-count').textContent = 0;
    return;
  }

  document.getElementById('user-count').textContent = users.length;
  tb.innerHTML = users.map((u,i)=>`
    <tr>
      <td class="mono col-idx" data-label="#">${i+1}</td>
      <td class="tl" data-label="Email">${escapeHtml(u.email)}</td>
      <td class="tl" data-label="Ady">${escapeHtml(u.name||'—')}</td>
      <td data-label="Rol">${u.role === 'admin' ? 'Admin' : 'Ulanyjy'}</td>
      <td class="mono" data-label="Kod">••••</td>
      <td data-label="Amal">
        ${(CURRENT_USER && u.id === CURRENT_USER.id)
          ? '<span style="color:#aab">siz</span>'
          : `<button class="btn btn-sm btn-trash" onclick="removeUser(${u.id})">✕ Poz</button>`}
      </td>
    </tr>`).join('');
}

function toggleLoginCodeVisibility() {
  const inp = document.getElementById('login-code');
  const btn = document.getElementById('login-code-toggle');
  if (!inp || !btn) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.classList.toggle('is-visible', show);
  btn.title = show ? 'Gizlemek' : 'Görmek';
  btn.setAttribute('aria-label', show ? 'Kody gizlemek' : 'Kody görmek');
  const openEye = btn.querySelector('.eye-open');
  const closedEye = btn.querySelector('.eye-closed');
  if (openEye) openEye.hidden = show;
  if (closedEye) closedEye.hidden = !show;
}

function resetLoginCodeVisibility() {
  const inp = document.getElementById('login-code');
  const btn = document.getElementById('login-code-toggle');
  if (inp) inp.type = 'password';
  if (!btn) return;
  btn.classList.remove('is-visible');
  btn.title = 'Görmek';
  btn.setAttribute('aria-label', 'Kody görmek');
  const openEye = btn.querySelector('.eye-open');
  const closedEye = btn.querySelector('.eye-closed');
  if (openEye) openEye.hidden = false;
  if (closedEye) closedEye.hidden = true;
}

/* ══ BOOT — ähli skriptler ýüklenenden soň işleýär ══════ */
(function(){
  const codeInput = document.getElementById('login-code');
  if(codeInput){
    codeInput.addEventListener('keydown', e=>{ if(e.key === 'Enter') submitAuth(); });
  }
  const emailInput = document.getElementById('login-email');
  if(emailInput){
    emailInput.addEventListener('keydown', e=>{ if(e.key === 'Enter') document.getElementById('login-code').focus(); });
  }

  // Başlangyç: token bar bolsa ulanyjyny dikeltjek bolýarys, ýogsa guest.
  (async ()=>{
    if(getToken()){
      try{
        CURRENT_USER = await API.me();
      }catch(e){
        clearToken();
        CURRENT_USER = null;
      }
    }
    if(isAdmin()) enterAdmin();
    else setGuestMode();
  })();
})();
