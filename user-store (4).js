
/**
 * user-store.js (hashed passwords + dynamic n8n endpoint from app Settings)
 * Reads Users Webhook URL from settings.usersEndpoint
 */
(function () {
  'use strict';

  const TZ = 'Africa/Johannesburg';
  const LS = {
    get(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null }catch(e){ return null } },
    set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} },
    del(k){ try{ localStorage.removeItem(k) }catch(e){} },
  };

  function getUsersEndpoint(){
    const s = LS.get('settings') || {};
    return (s.usersEndpoint || '').trim();
  }
  function setUsersEndpoint(url){
    const s = LS.get('settings') || {};
    s.usersEndpoint = (url||'').trim();
    LS.set('settings', s);
    return s.usersEndpoint;
  }

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

  async function fetchUsersRemote(){
    const EP = getUsersEndpoint();
    if (!EP) throw new Error('Users endpoint not configured');
    const res = await fetch(EP, { method: 'GET', headers: { 'Accept':'application/json' }, credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch users: ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.users)) throw new Error('Invalid users shape');
    return data.users;
  }
  async function saveUsersRemote(users){
    const EP = getUsersEndpoint();
    if (!EP) throw new Error('Users endpoint not configured');
    const res = await fetch(EP, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json' },
      credentials: 'include',
      body: JSON.stringify({ users })
    });
    if (!res.ok) throw new Error('Failed to save users: ' + res.status + ' ' + (await res.text()));
    return true;
  }

  function ensureSettings(){
    const s = LS.get('settings') || {};
    if (!Array.isArray(s.users)) s.users = s.users || [];
    LS.set('settings', s);
    return s;
  }
  function getSettings(){ return ensureSettings() }
  function saveSettings(next){ const s = ensureSettings(); Object.assign(s,next||{}); LS.set('settings', s); return s; }
  function listUsersLocal(){ return (ensureSettings().users||[]).slice() }
  function saveUsersLocal(users){ const s=ensureSettings(); s.users=users.slice(); LS.set('settings', s); return true }

  async function listUsers(){ try{ return await fetchUsersRemote() }catch(e){ console.warn('[UserStore] remote list failed:', e.message); return listUsersLocal() } }
  async function saveUsers(users){ try{ return await saveUsersRemote(users) }catch(e){ console.warn('[UserStore] remote save failed:', e.message); return saveUsersLocal(users) } }

  async function addUser(username, password){
    username=(username||'').trim(); password=(password||'').trim();
    if(!username||!password) throw new Error('Username and password required');
    const users = await listUsers();
    if(users.some(x=>x.u===username)) throw new Error('User already exists');
    const salt = genSalt(16);
    const ph = await sha256Hex(salt + password);
    users.push({ u: username, ph, salt });
    await saveUsers(users);
    return users;
  }

  async function deleteUser(username){
    const users = await listUsers();
    const i = users.findIndex(x=>x.u===username);
    if(i<0) throw new Error('User not found');
    if(users.length<=1) throw new Error('Cannot delete the last user');
    const cur = getCurrentUser();
    if(cur && cur.u===username) throw new Error('Log out before deleting this user');
    users.splice(i,1);
    await saveUsers(users);
    return users;
  }

  async function login(username, password){
    const users = await listUsers();
    const rec = users.find(x=>x.u===username);
    if(!rec) return false;
    const ph = await sha256Hex(rec.salt + password);
    if(ph !== rec.ph) return false;
    LS.set('currentUser', { u: username, ts: new Date().toISOString(), tz: TZ });
    return true;
  }

  function logout(){ LS.del('currentUser') }
  function getCurrentUser(){ return LS.get('currentUser') }

  window.UserStore = { tz:TZ, getSettings, saveSettings, listUsers, saveUsers, addUser, deleteUser, login, logout, getCurrentUser, getUsersEndpoint, setUsersEndpoint };
})();
