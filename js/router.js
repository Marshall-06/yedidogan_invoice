'use strict';

/* ══════════════════════════════════════════════════════
   ROUTER — SPA sahypa geçişi (navigation)
   Sahypalary görkezýär/gizleýär we hash bilen sinhronizasiýa.
══════════════════════════════════════════════════════ */

const PAGES = ['inventory', 'inventory-form', 'invoice', 'production', 'admin'];
const ADMIN_PAGES = ['inventory-form', 'invoice', 'production', 'admin'];

function navigate(page){
  if(!PAGES.includes(page)) page = 'inventory';

  // Diňe admin sahypalary — ulanyjy bolsa Harytlar Bazasyna gaýtarylýar
  if(ADMIN_PAGES.includes(page) && !(typeof isAdmin === 'function' && isAdmin())){
    page = 'inventory';
  }

  PAGES.forEach(p=>{
    const sec = document.getElementById('page-'+p);
    if(sec) sec.style.display = (p === page) ? '' : 'none';
  });

  document.querySelectorAll('.sb-link').forEach(btn=>{
    const dp = btn.dataset.page;
    btn.classList.toggle('active', dp === page || (page === 'inventory-form' && dp === 'inventory'));
  });

  const hashPage = page === 'inventory-form' ? 'inventory' : page;
  if(location.hash !== '#'+hashPage && page !== 'inventory-form'){
    history.replaceState(null, '', '#'+page);
  } else if(page === 'inventory-form' && !location.hash.includes('inventory')){
    history.replaceState(null, '', '#inventory');
  }

  if(page === 'inventory') renderInventory();
  if(page === 'inventory-form'){
    if(typeof refreshAllItems === 'function') refreshAllItems('').catch(()=>{});
    else if(typeof refreshItems === 'function') refreshItems('', { limit: 500, offset: 0 }).catch(()=>{});
  }
  if(page === 'invoice'){
    if(typeof closePrintPreview === 'function') closePrintPreview();
    // Ähli harytlary ýükleme — skan serwerde /lookup bilen işleýär
    if(typeof refreshInvoicesIndex === 'function') refreshInvoicesIndex().catch(()=>{});
    if(typeof setInvoiceEditorVisible === 'function') setInvoiceEditorVisible(false);
  }
  if(page === 'production'){
    if(typeof loadPoMeta === 'function') loadPoMeta().catch(()=>{});
    if(typeof refreshPoIndex === 'function') refreshPoIndex().catch(()=>{});
    if(typeof poEditorOpen !== 'undefined' && !poEditorOpen && typeof setPoEditorVisible === 'function'){
      setPoEditorVisible(false);
    }
  }
  if(page === 'admin'     && typeof renderUsers  === 'function') renderUsers();

  window.scrollTo({top:0});
}

// Hash üýtgände (yza/öňe düwmeleri) — sinhronla
window.addEventListener('hashchange', ()=>{
  navigate((location.hash || '#inventory').slice(1));
});

// Başlangyç navigasiýany auth.js (boot) dolandyrýar — token barlanandan soň
// setGuestMode() ýa-da enterAdmin() çagyrylyp, navigate() işledilýär.
