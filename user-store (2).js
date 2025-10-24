/**
 * user-store.js (hashed passwords + single-file remote users store via n8n)
 * Set USERS_ENDPOINT to your n8n webhook URL (GET/PUT/OPTIONS).
 */
(function () {
  'use strict';

  // ======= CONFIG =======
  const USERS_ENDPOINT = 'https://<YOUR_N8N_DOMAIN>/webhook/users'; // e.g. https://n8n.example.com/webhook/users
  const tz = 'Africa/Johannesburg';

  const defaultElecTypes = [
    'Actaris','Ampy','CBI','Econ','Enligt','Hexing','Ihemeter 3PH WC',
    'Kamstrup 1PH','Kamstrup 3PH','L+G Cashpower','L+G E460','TSK/3',
    'VC1800','VC3000','VC3100','Unknown'
  ];
  const defaultWaterTypes = ['Lesira','Kent','Sensus','Elster'];

  // ======= Helpers =======
  const LS = {
    get(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null }catch(e){ return null } },
    set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} },
    del(k){ try{ localStorage.removeItem(k) }catch(e){} },
  };

  function toHex(buf){
    const bytes = new Uint8Array(buf);
    let s=''; for (let i=0;i<bytes.length;i++){ s += bytes[i].toString(16).padStart(2,'0') }
    return s;
  }
  async function sha256Hex(text){
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    return toHex(digest);
  }
  function genSalt(len=16){
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // ======= Settings =======
  function ensureDefaults(){
    const s = LS.get('settings') || {};
    if (!Array.isArray(s.elecTypes)) s.elecTypes = [...defaultElecTypes];
    else {
      const merged = [...new Set([...(s.elecTypes||[]), ...defaultElecTypes])];
      const i = merged.indexOf('Unknown'); if (i>-1) merged.splice(i,1);
      merged.sort((a,b)=>a.localeCompare(b)); merged.push('Unknown');
      s.elecTypes = merged;
    }
    if (!Array.isArray(s.waterTypes)) s.waterTypes = [...defaultWaterTypes];
    if (!Array.isArray(s.users)) s.users = []; // not used when USERS_ENDPOINT is set
    LS.set('settings', s);
    return s;
  }

  function getSettings(){ return ensureDefaults() }
  function saveSettings(next){
    const s = ensureDefaults();
    const merged = Object.assign({}, s, next || {});
    LS.set('settings', merged);
    return merged;
  }

  // ======= Remote Users (single file) =======
  async function fetchUsersRemote(){
    const res = await fetch(USERS_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to fetch remote users: ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.users)) throw new Error('Invalid users.json shape');
    return data.users;
  }
  async function saveUsersRemote(users){
    const res = await fetch(USERS_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json' },
      credentials: 'include',
      body: JSON.stringify({ users })
    });
    if (!res.ok) throw new Error('Failed to save remote users: ' + res.status + ' ' + (await res.text()));
    return true;
  }

  // ======= Local Users (fallback if endpoint missing/offline) =======
  function listUsersLocal(){ const s = ensureDefaults(); return (s.users || []).slice() }
  function saveUsersLocal(users){
    const s = ensureDefaults(); s.users = users.slice(); LS.set('settings', s); return true;
  }

  async function listUsers(){
    if (USERS_ENDPOINT && USERS_ENDPOINT.startsWith('http')) {
      try { return await fetchUsersRemote() } catch(e){ console.warn('Remote users fetch failed, using local:', e) }
    }
    return listUsersLocal();
  }
  async function saveUsers(users){
    if (USERS_ENDPOINT && USERS_ENDPOINT.startsWith('http')) {
      try { return await saveUsersRemote(users) } catch(e){ console.warn('Remote users save failed, using local:', e) }
    }
    return saveUsersLocal(users);
  }

  // ======= Account ops (hashed) =======
  async function addUser(username, password){
    username = (username||'').trim(); password = (password||'').trim();
    if (!username || !password) throw new Error('Username and password required');
    const users = await listUsers();
    if (users.some(x=>x.u===username)) throw new Error('User already exists');
    const salt = genSalt(16);
    const ph = await sha256Hex(salt + password); // salted hash
    users.push({ u: username, ph, salt });
    await saveUsers(users);
    return users;
  }

  async function deleteUser(username){
    const users = await listUsers();
    const i = users.findIndex(x=>x.u===username);
    if (i<0) throw new Error('User not found');
    if (users.length<=1) throw new Error('Cannot delete the last user');
    const cur = getCurrentUser();
    if (cur && cur.u === username) throw new Error('Log out before deleting this user');
    users.splice(i,1);
    await saveUsers(users);
    return users;
  }

  async function login(username, password){
    const users = await listUsers();
    const rec = users.find(x=>x.u===username);
    if (!rec) return false;
    const ph = await sha256Hex(rec.salt + password);
    if (ph !== rec.ph) return false;
    LS.set('currentUser', { u: username, ts: new Date().toISOString(), tz });
    return true;
  }

  function logout(){ LS.del('currentUser') }
  function getCurrentUser(){ return LS.get('currentUser') }

  const api = {
    tz,
    getSettings, saveSettings, ensureDefaults,
    listUsers, saveUsers,
    addUser, deleteUser, login, logout, getCurrentUser,
    _sha256Hex: sha256Hex
  };

  window.UserStore = api;
})();