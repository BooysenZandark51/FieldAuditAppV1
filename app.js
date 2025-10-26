// ====== CONFIG ======
const TZ = 'Africa/Johannesburg';

// Test startup discovery (adjust when you flip to prod)
const STARTUP_WEBHOOK = 'https://n8n.srv1079977.hstgr.cloud/webhook-test/StarupAndRetrieve';
const DISCOVERY_TTL_MS = 12 * 60 * 60 * 1000;

const DEFAULT_SETTINGS = {
  // Post-only auth
  authWebhook: 'https://n8n.srv1079977.hstgr.cloud/webhook-test/InfoCheckValidatePassword',
  // Data upload
  webhook: 'https://n8n.srv1079977.hstgr.cloud/webhook-test/AuditUpload',
  webhookUrl: 'https://n8n.srv1079977.hstgr.cloud/webhook-test/AuditUpload',
  // Create user
  createUserWebhook: 'https://n8n.srv1079977.hstgr.cloud/webhook-test/UserInfo'
};

const PROD_DEFAULTS = {
  authWebhook: 'https://n8n.srv1079977.hstgr.cloud/webhook/InfoCheckValidatePassword',
  webhook: 'https://n8n.srv1079977.hstgr.cloud/webhook/AuditUpload',
  webhookUrl: 'https://n8n.srv1079977.hstgr.cloud/webhook/AuditUpload',
  createUserWebhook: 'https://n8n.srv1079977.hstgr.cloud/webhook/UserInfo'
};

// ====== UTIL & STORAGE ======
const LS = (() => {
  let mem = {}; let ok = true;
  try { const t = '_ls_'; localStorage.setItem(t, '1'); localStorage.removeItem(t); } catch { ok = false; }
  return {
    get(k){ try{ if(ok){ const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } return mem[k] ?? null } catch { return null } },
    set(k,v){ try{ if(ok){ localStorage.setItem(k, JSON.stringify(v)) } else { mem[k] = v } } catch {} },
    del(k){ try{ if(ok){ localStorage.removeItem(k) } else { delete mem[k] } } catch {} }
  };
})();

function makeId(){ return (crypto.randomUUID?.() || (Date.now() + "-" + Math.random())).toString(); }
function ensureClientId(){
  const key = 'client_id';
  let id = LS.get(key);
  if(!id){ id = makeId(); LS.set(key, id); }
  return id;
}
function userKey(k){
  const u = LS.get('currentUser');
  return (u && u.u) ? `${k}@${u.u}` : `guest:${k}`;
}
function fmt(n){ return (n||0).toLocaleString('en-ZA'); }

// ====== DISCOVERY & SETTINGS ======
function mergeSettings(server){
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem('settings') || '{}'); } catch {}
  const raw = { ...DEFAULT_SETTINGS, ...cur, ...server };
  const unified = (raw.webhook || raw.webhookUrl || '').trim();
  const merged = { ...raw, webhook: unified, webhookUrl: unified };
  localStorage.setItem('settings', JSON.stringify(merged));
  return merged;
}

async function discoverConfig(){
  const now = Date.now();
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem('__discovery_cache__') || 'null'); } catch {}
  if (cache && cache.ts && (now - cache.ts < DISCOVERY_TTL_MS) && cache.settings) {
    mergeSettings(cache.settings);
    return { ok: true, cached: true };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(STARTUP_WEBHOOK, { method: 'GET', mode: 'cors', credentials: 'omit', signal: controller.signal });
    clearTimeout(timer);
    if(!res.ok) throw new Error('Discovery HTTP ' + res.status);
    const data = await res.json().catch(() => null);
    const serverSettings = (data && (data.settings || data)) || null;
    if (serverSettings) {
      mergeSettings(serverSettings);
      localStorage.setItem('__discovery_cache__', JSON.stringify({ ts: now, settings: serverSettings }));
      return { ok: true, cached: false };
    }
  } catch {}
  return { ok: false };
}

const defaultsElec = ['Actaris','Ampy','CBI','Econ','Enligt','Hexing','Ihemeter 3PH WC','Kamstrup 1PH','Kamstrup 3PH','L+G Cashpower','L+G E460','TSK/3','VC1800','VC3000','VC3100','Unknown'];
const defaultsWater = ['Lesira','Kent','Sensus','Elster'];

function ensureSettings(){
  const s = LS.get('settings') || {};
  if (!Array.isArray(s.elecTypes)) s.elecTypes = [...defaultsElec];
  else {
    const merged = [...new Set([...s.elecTypes, ...defaultsElec])].filter(x=>x!=='Unknown').sort((a,b)=>a.localeCompare(b));
    merged.push('Unknown'); s.elecTypes = merged;
  }
  if (!Array.isArray(s.waterTypes)) s.waterTypes = [...defaultsWater];
  if (typeof s.team !== 'string') s.team = '';
  if (typeof s.authWebhook !== 'string') s.authWebhook = '';
  if (typeof s.createUserWebhook !== 'string') s.createUserWebhook = '';
  if (typeof s.webhook !== 'string') s.webhook = '';
  if (typeof s.webhookUrl !== 'string') s.webhookUrl = '';
  const unified = (s.webhook || s.webhookUrl || '').trim();
  s.webhook = unified; s.webhookUrl = unified;
  LS.set('settings', s);
  return s;
}
function getCreateUserWebhook(){ const s = LS.get('settings') || {}; return (s.createUserWebhook || '').trim(); }

// ====== UI HELPERS ======
let __wasOffline = null;
let __lastToastTs = 0;
function toast(msg, opts){
  opts = opts || {};
  const now = Date.now();
  const win = typeof opts.throttleMs === 'number' ? opts.throttleMs : 1500;
  if (now - __lastToastTs < win) return;
  __lastToastTs = now;
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', left: '50%', transform: 'translateX(-50%)',
    bottom: '18px', padding: '10px 14px', borderRadius: '10px',
    background: 'rgba(0,0,0,.8)', color: '#fff', fontSize: '14px',
    border: '1px solid rgba(255,255,255,.15)', zIndex: 99999, maxWidth: '90%', textAlign:'center'
  });
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), opts.duration || 2000);
}
function updateOnlineUi(){
  const submitBtn = document.querySelector('#captureForm button[type="submit"]');
  const offline = !navigator.onLine;
  if (submitBtn) submitBtn.disabled = offline;
}
window.addEventListener('online', () => {
  updateOnlineUi();
  if (__wasOffline !== false) toast('Back online');
  __wasOffline = false;
});
window.addEventListener('offline', () => {
  updateOnlineUi();
  if (__wasOffline !== true) toast('You are offline. Submissions will queue to Outbox.');
  __wasOffline = true;
});

// ====== FORM + OUTBOX ======
const FIELD_IDS = ['stand','area','street','clientInfo','elecSn','elecType','minisub','feeder','supplyCable','breakerState','waterSn','waterType','standNote'];
function val(id){ const el = document.getElementById(id); return (el && el.value ? el.value : '').trim(); }
function gather(){ const d = {}; FIELD_IDS.forEach(id => { const el = document.getElementById(id); if (el) d[id] = el.value; }); d._ts = new Date().toISOString(); return d; }
function applyDraft(d){ if(!d) return; FIELD_IDS.forEach(id => { if (d[id] !== undefined){ const el = document.getElementById(id); if(el) el.value = d[id]; } }); }
function saveDraft(){ LS.set(userKey('draft'), gather()); }
function loadDraft(){ const d = LS.get(userKey('draft')); if (d) applyDraft(d); }
function resetForm(){
  const form = document.getElementById('captureForm');
  form?.reset();
  LS.del(userKey('draft'));
  populateTypes();
  ['area','elecType','supplyCable','breakerState','waterType'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const s = document.getElementById('status'); if (s) s.textContent = '';
  const first = document.getElementById('stand'); first && first.focus();
}
async function sendToWebhook(body, url){
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: res.ok };
  } catch { return { ok: false }; }
}
function queuePayload(p){
  const out = LS.get(userKey('outbox')) || [];
  out.push(p); LS.set(userKey('outbox'), out);
  refreshKpis(); renderOutbox();
}

let __syncInFlight = false;
async function syncOutbox(opts){
  opts = opts || { silent: false };
  if (__syncInFlight) return;
  __syncInFlight = true;

  const s = LS.get('settings') || {};
  const sendUrl = (s.webhook || s.webhookUrl || '').trim();
  if (!sendUrl){ __syncInFlight = false; if(!opts.silent) alert('Set your webhook in Settings'); return; }

  let out = LS.get(userKey('outbox')) || [];
  if (out.length === 0){ __syncInFlight = false; if(!opts.silent) alert('Nothing to sync'); return; }

  const delayMs = 2000; let sent = 0;
  const finalize = (hadFail) => {
    __syncInFlight = false;
    refreshKpis();
    if (!opts.silent){
      const remaining = (LS.get(userKey('outbox')) || []).length;
      let msg = `Synced ${sent} item(s)`;
      msg += hadFail ? `; stopped on an error. Remaining: ${remaining}` : '; done.';
      alert(msg);
    }
  };

  const processNext = async () => {
    out = LS.get(userKey('outbox')) || [];
    if (out.length === 0){ finalize(false); return; }
    const item = out[0];
    const r = await sendToWebhook(item, sendUrl);
    if (r && r.ok){
      out.shift();
      LS.set(userKey('outbox'), out);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
      const log = LS.get(userKey('sentLog')) || {};
      log[today] = (log[today] || 0) + 1;
      LS.set(userKey('sentLog'), log);
      sent++; refreshKpis();
      setTimeout(processNext, delayMs);
    } else {
      finalize(true);
    }
  };
  processNext();
}

function renderOutbox(){
  const tb = document.querySelector('#outboxTable tbody'); if(!tb) return;
  tb.innerHTML = '';
  const out = LS.get(userKey('outbox')) || [];
  out.forEach((it,i) => {
    const tr = document.createElement('tr');
    const ts = it?.meta?.submitted_at ? new Date(it.meta.submitted_at).toLocaleString() : '—';
    const stand = it?.record?.stand || '';
    const area = it?.record?.area || '';
    const street = it?.record?.street || '';
    tr.innerHTML = `
      <td style="padding:6px;border-bottom:1px solid #334155">${i+1}</td>
      <td style="padding:6px;border-bottom:1px solid #334155">${stand}</td>
      <td style="padding:6px;border-bottom:1px solid #334155">${area}</td>
      <td style="padding:6px;border-bottom:1px solid #334155">${street}</td>
      <td style="padding:6px;border-bottom:1px solid #334155">${ts}</td>`;
    tb.appendChild(tr);
  });
}

function refreshKpis(){
  const out = LS.get(userKey('outbox')) || [];
  const qc = document.getElementById('queuedCount'); if (qc) qc.textContent = fmt(out.length);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const sentLog = LS.get(userKey('sentLog')) || {};
  const sc = document.getElementById('sentCount'); if (sc) sc.textContent = fmt(sentLog[today] || 0);

  const tab = document.getElementById('tabOutbox'); if (tab) tab.textContent = `Outbox (${out.length})`;

  const b1 = document.getElementById('syncBtn');
  const b2 = document.getElementById('syncBtn2');
  const disabled = out.length === 0;
  if (b1) b1.disabled = disabled;
  if (b2) b2.disabled = disabled;
}

function populateTypes(){
  const s = ensureSettings();
  const e = document.getElementById('elecType');
  const w = document.getElementById('waterType');

  function set(sel, arr){
    if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    const o = document.createElement('option'); o.value=''; o.textContent='—'; sel.appendChild(o);
    arr.forEach(t => { const opt = document.createElement('option'); opt.textContent = t; sel.appendChild(opt); });
    const other = document.createElement('option'); other.textContent='Other'; sel.appendChild(other);
    let found = false;
    for(let i=0;i<sel.options.length;i++){ if(sel.options[i].textContent === cur){ found = true; break; } }
    sel.value = found ? cur : '';
  }
  set(e, s.elecTypes);
  set(w, s.waterTypes);
}

// ====== GPS ======
function updateBadge(lat, lon, acc){
  const el = document.getElementById('gps'); if (!el) return;
  el.textContent = `GPS: ${lat.toFixed(6)}, ${lon.toFixed(6)} (±${Math.round(acc)} m)`;
}
function startGeoWatch(){
  const gpsEl = document.getElementById('gps');
  if (!('geolocation' in navigator)){ gpsEl && (gpsEl.textContent = 'GPS: unavailable'); return; }
  gpsEl && (gpsEl.textContent = 'GPS: locating…');
  navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude, accuracy } = pos.coords;
    updateBadge(latitude, longitude, accuracy);
    LS.set(userKey('lastGPS'), { latitude, longitude, accuracy, ts: new Date().toISOString() });
  }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
}

// ====== AUTH (POST ONLY) ======
async function postLogin(e){
  e?.preventDefault?.(); e?.stopPropagation?.(); e?.stopImmediatePropagation?.();
  const u = (document.getElementById('loginUser')?.value || '').trim();
  const p = (document.getElementById('loginPass')?.value || '').trim();
  if (!u || !p){ alert('Enter username and password'); return; }
  const btn = document.querySelector('#loginForm button[type="submit"]');
  if (btn){ btn.disabled = true; btn.textContent = 'Signing in…'; }
  try {
    function getConfiguredAuthWebhook(){
      try{ return (JSON.parse(localStorage.getItem('settings') || '{}').authWebhook || '').trim(); }
      catch { return ''; }
    }
    const authUrl = getConfiguredAuthWebhook() || DEFAULT_SETTINGS.authWebhook;
    const res = await fetch(authUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    if (!res.ok) throw new Error('Auth HTTP ' + res.status);
    const data = await res.json().catch(() => null);
    if (!data || data.ok !== true) throw new Error((data && data.message) || 'Invalid credentials');

    const cur = ensureSettings();
    const server = (data && data.settings) ? data.settings : {};
    const raw = { ...DEFAULT_SETTINGS, ...cur, ...server };
    const webhookValue = raw.webhook || raw.webhookUrl || '';
    const merged = { ...raw, webhook: webhookValue, webhookUrl: webhookValue };

    LS.set('settings', merged);

    const roleFromServer = (data && data.user && data.user.role) || 'user';
    LS.set('currentUser', { u, role: roleFromServer, ts: new Date().toISOString(), tz: TZ });

    setAuthUI();
    requestAnimationFrame(()=> { try{ switchTab('capture'); } catch{} });
    alert('login Success');
  } catch (err){
    console.error('Login failed:', err);
    alert('Login failed: ' + String(err?.message || err));
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = 'Sign in'; }
  }
}

function logout(){
  LS.del('currentUser');
  try {
    const form = document.getElementById('captureForm');
    form?.reset();
    ['area','elecType','supplyCable','breakerState','waterType'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  } catch {}
  setAuthUI();
}

function openSettings(){
  const cur = LS.get('currentUser');
  if (!(cur && cur.role === 'admin')) { alert('Only admins can open Settings'); return; }
  const dlg = document.getElementById('settings');
  if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
  else if (dlg) dlg.setAttribute('open','');
  loadSettings(); renderUsers(); renderTypeLists();
}

function setAuthUI(){
  const cur = LS.get('currentUser');
  const app = document.getElementById('app');
  const login = document.getElementById('login');
  const badge = document.getElementById('currentUserBadge');
  const settingsBtn = document.getElementById('settingsBtn');

  if (cur && cur.u){
    const role = cur.role || 'user';
    if (badge) badge.textContent = `User: ${cur.u} (${role})`;
    app?.classList.remove('hidden'); login?.classList.add('hidden');
    const isAdmin = role === 'admin';
    if (settingsBtn) settingsBtn.classList.toggle('hidden', !isAdmin);

    refreshKpis(); populateTypes(); loadDraft(); startGeoWatch();
    const g = LS.get(userKey('lastGPS')); if (g) updateBadge(g.latitude, g.longitude, g.accuracy);
  } else {
    if (badge) badge.textContent = 'User: —';
    app?.classList.add('hidden'); login?.classList.remove('hidden');
    settingsBtn?.classList.add('hidden');
  }
}

// ====== SETTINGS DIALOG BEHAVIOUR ======
function loadSettings(){
  const s = ensureSettings();
  const sendUrl = (s.webhook || s.webhookUrl || '').trim();
  const wh = document.getElementById('webhook');
  const team = document.getElementById('team');
  const auth = document.getElementById('authWebhook');
  const cu = document.getElementById('createUserWebhook');
  if (wh) wh.value = sendUrl;
  if (team) team.value = s.team || '';
  if (auth) auth.value = s.authWebhook || '';
  if (cu) cu.value = s.createUserWebhook || '';
}

function saveSettings(){
  const wh = (document.getElementById('webhook')?.value || '').trim();
  const team = (document.getElementById('team')?.value || '').trim();
  const auth = (document.getElementById('authWebhook')?.value || '').trim();
  const cu = (document.getElementById('createUserWebhook')?.value || '').trim();

  const s = ensureSettings();
  s.webhook = wh; s.webhookUrl = wh; s.team = team; s.authWebhook = auth; s.createUserWebhook = cu;
  LS.set('settings', s);

  const dlg = document.getElementById('settings'); dlg?.close?.();
  populateTypes();
  alert('Settings saved');
}

function renderUsers(){ const box = document.getElementById('usersList'); if (!box) return; box.innerHTML = ''; }
function renderTypeLists(){
  const s = ensureSettings();
  const el = document.getElementById('elecTypesList');
  const wl = document.getElementById('waterTypesList');
  if (el){
    el.innerHTML = '';
    s.elecTypes.forEach((t,i) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `${t} <button type="button" data-del-elec="${i}">✕</button>`;
      el.appendChild(tag);
    });
  }
  if (wl){
    wl.innerHTML = '';
    s.waterTypes.forEach((t,i) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `${t} <button type="button" data-del-water="${i}">✕</button>`;
      wl.appendChild(tag);
    });
  }
}
function addElecType(){
  const v = (document.getElementById('elecTypeNew')?.value || '').trim(); if (!v) return;
  const s = ensureSettings();
  if (!s.elecTypes.includes(v)){
    if (v !== 'Unknown'){
      s.elecTypes = [...new Set([...s.elecTypes.filter(x=>x!=='Unknown'), v])].sort((a,b)=>a.localeCompare(b));
      s.elecTypes.push('Unknown');
    }
  }
  LS.set('settings', s);
  const el = document.getElementById('elecTypeNew'); if (el) el.value = '';
  renderTypeLists(); populateTypes();
}
function delElecType(i){
  const s = ensureSettings(); s.elecTypes.splice(i,1);
  if (!s.elecTypes.includes('Unknown')) s.elecTypes.push('Unknown');
  s.elecTypes = [...new Set(s.elecTypes.filter(x=>x!=='Unknown'))].sort((a,b)=>a.localeCompare(b)); s.elecTypes.push('Unknown');
  LS.set('settings', s); renderTypeLists(); populateTypes();
}
function addWaterType(){
  const v = (document.getElementById('waterTypeNew')?.value || '').trim(); if (!v) return;
  const s = ensureSettings(); if (!s.waterTypes.includes(v)) s.waterTypes.push(v);
  LS.set('settings', s); const el = document.getElementById('waterTypeNew'); if (el) el.value = '';
  renderTypeLists(); populateTypes();
}
function delWaterType(i){
  const s = ensureSettings(); s.waterTypes.splice(i,1); LS.set('settings', s); renderTypeLists(); populateTypes();
}

// ====== CAPTURE SUBMIT ======
async function onSubmit(e){
  e.preventDefault();
  const s = ensureSettings();
  const gps = LS.get(userKey('lastGPS'));
  const cur = LS.get('currentUser');

  const payload = {
    meta: {
      version: 1,
      submitted_at: new Date().toISOString(),
      timezone: TZ,
      team: s.team || null,
      ua: navigator.userAgent,
      user: cur && cur.u ? cur.u : null,
      client_id: ensureClientId()
    },
    record: {
      stand: val('stand'),
      area: val('area'),
      street: val('street'),
      client_info: val('clientInfo'),
      electrical: {
        sn: val('elecSn'),
        type: val('elecType'),
        minisub: val('minisub'),
        feeder: val('feeder'),
        supply_cable: val('supplyCable'),
        breaker_state: val('breakerState')
      },
      water: { sn: val('waterSn'), type: val('waterType') },
      stand_note: val('standNote'),
      gps: gps || null
    },
    request_id: makeId()
  };

  if (!val('stand') || !val('area') || !val('street') || !val('minisub') || !val('supplyCable') || !val('breakerState')){
    alert('Please fill all required fields: Stand Nr, Area, Street Address, Minisub / Bulk, Supply Cable, Breaker State');
    return;
  }

  const sendUrl = (s.webhook || s.webhookUrl || '').trim();
  if (!sendUrl){ queuePayload(payload); resetForm(); alert('No webhook set – queued to Outbox'); return; }

  const r = await sendToWebhook(payload, sendUrl);
  if (r && r.ok){
    const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
    const log = LS.get(userKey('sentLog')) || {};
    log[today] = (log[today] || 0) + 1;
    LS.set(userKey('sentLog'), log);
    refreshKpis(); resetForm(); alert('Submitted ✔');
  } else {
    queuePayload(payload); resetForm(); alert('Offline or server error – queued to Outbox');
  }
}

// ====== TAB SWITCH ======
function switchTab(which){
  const cap = document.getElementById('viewCapture');
  const out = document.getElementById('viewOutbox');
  const b1 = document.getElementById('tabCapture');
  const b2 = document.getElementById('tabOutbox');
  if (which === 'outbox'){
    cap?.classList.add('hidden'); out?.classList.remove('hidden');
    b1?.classList.remove('active'); b2?.classList.add('active'); renderOutbox();
  } else {
    out?.classList.add('hidden'); cap?.classList.remove('hidden');
    b2?.classList.remove('active'); b1?.classList.add('active');
  }
}

// ====== BOOT ======
function __ensureDefaultWebhooks(){
  const cur = LS.get('settings') || {};
  const raw = { ...DEFAULT_SETTINGS, ...cur };
  const webhookValue = raw.webhook || raw.webhookUrl || '';
  const merged = { ...raw, webhook: webhookValue, webhookUrl: webhookValue };
  LS.set('settings', merged);
  requestAnimationFrame(()=> setTimeout(()=>{
    const s = LS.get('settings') || {};
    const elWebhook = document.querySelector('#webhook');
    const elAuth = document.querySelector('#authWebhook');
    const elCreate = document.querySelector('#createUserWebhook');
    if (elWebhook) elWebhook.value = s.webhook || s.webhookUrl || '';
    if (elAuth) elAuth.value = s.authWebhook || '';
    if (elCreate) elCreate.value = s.createUserWebhook || '';
  },0));
}

window.addEventListener('beforeunload', (e) => {
  const out = LS.get(userKey('outbox')) || [];
  if (out.length > 0){ e.preventDefault(); e.returnValue = ''; }
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tz').textContent = TZ;

  // bind listeners
  document.getElementById('loginForm').addEventListener('submit', postLogin);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('captureForm').addEventListener('submit', onSubmit);
  document.getElementById('syncBtn').addEventListener('click', () => syncOutbox());
  document.getElementById('syncBtn2').addEventListener('click', () => syncOutbox());
  document.getElementById('tabCapture').addEventListener('click', () => switchTab('capture'));
  document.getElementById('tabOutbox').addEventListener('click', () => switchTab('outbox'));

  // Create user (with role)
  document.getElementById('addUserBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    const user = (document.getElementById('newUser')?.value || '').trim();
    const pass = (document.getElementById('newPass')?.value || '').trim();
    const role = (document.getElementById('newRole')?.value || 'user').trim();
    if (!user || !pass) { alert('Enter username and password'); return; }
    const url = getCreateUserWebhook();
    if (!url) { alert('Create-User Webhook not set'); return; }
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass, role }),
        mode: 'cors', credentials: 'omit'
      });
      if (!res.ok) { alert('Create user failed'); return; }
      document.getElementById('newUser').value = '';
      document.getElementById('newPass').value = '';
      document.getElementById('newRole').value = 'user';
      alert('User file created');
    } catch {
      alert('Create user failed');
    }
  });

  document.getElementById('elecTypesList').addEventListener('click', e => {
    const t = e.target; const idx = t?.getAttribute('data-del-elec');
    if (idx != null) delElecType(parseInt(idx,10));
  });
  document.getElementById('waterTypesList').addEventListener('click', e => {
    const t = e.target; const idx = t?.getAttribute('data-del-water');
    if (idx != null) delWaterType(parseInt(idx,10));
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', (e)=>{ e.preventDefault(); saveSettings(); });
  document.getElementById('closeSettingsBtn').addEventListener('click', (e)=>{ e.preventDefault(); document.getElementById('settings')?.close?.(); });

  __ensureDefaultWebhooks();
  discoverConfig(); // async; merges when it returns

  refreshKpis(); updateOnlineUi();
  __wasOffline = !navigator.onLine;
  setAuthUI();
});

// (Optional) expose for debugging in console
window.setAuthUI = setAuthUI;
window.switchTab = switchTab;
window.ensureSettings = ensureSettings;
window.LS = LS;
