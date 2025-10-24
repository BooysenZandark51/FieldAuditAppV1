
/**
 * user-store.js
 * LocalStorage-backed user & settings persistence for Field Capture app.
 * Keeps the same behaviour as your inline LS logic, just moved into a reusable module.
 * You can swap internals to IndexedDB later without changing the app code.
 *
 * Usage (in index.html):
 *   <script type="module" src="user-store.js"></script>
 *   <script>
 *     // after DOMContentLoaded:
 *     UserStore.ensureDefaults();
 *     const cur = UserStore.getCurrentUser();
 *   </script>
 */
(function () {
  'use strict';

  const NS = 'UserStore';
  const tz = 'Africa/Johannesburg';
  const defaultElecTypes = [
    'Actaris','Ampy','CBI','Econ','Enligt','Hexing','Ihemeter 3PH WC',
    'Kamstrup 1PH','Kamstrup 3PH','L+G Cashpower','L+G E460','TSK/3',
    'VC1800','VC3000','VC3100','Unknown'
  ];
  const defaultWaterTypes = ['Lesira','Kent','Sensus','Elster'];

  const LS = {
    get(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null }catch(e){ return null } },
    set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} },
    del(k){ try{ localStorage.removeItem(k) }catch(e){} },
  };

  function ensureDefaults(){
    const s = LS.get('settings') || {};
    // Merge/ensure types
    if (!Array.isArray(s.elecTypes)) s.elecTypes = [...defaultElecTypes];
    else {
      const merged = [...new Set([...(s.elecTypes||[]), ...defaultElecTypes])];
      const i = merged.indexOf('Unknown');
      if (i>-1) merged.splice(i,1);
      merged.sort((a,b)=>a.localeCompare(b));
      merged.push('Unknown');
      s.elecTypes = merged;
    }
    if (!Array.isArray(s.waterTypes)) s.waterTypes = [...defaultWaterTypes];
    // Default users (keep your current seed user so you can log in and open Settings)
    if (!Array.isArray(s.users)) s.users = [{u:'Gerhard.B', p:'Gt55115511'}];
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

  function listUsers(){ return (ensureDefaults().users || []).slice() }

  function addUser(username, password){
    username = (username||'').trim(); password = (password||'').trim();
    if (!username || !password) throw new Error('Username and password required');
    const s = ensureDefaults();
    if (s.users.some(x=>x.u===username)) throw new Error('User already exists');
    s.users.push({u:username, p:password});
    LS.set('settings', s);
    return listUsers();
  }

  function deleteUser(username){
    const s = ensureDefaults();
    const i = s.users.findIndex(x=>x.u===username);
    if (i<0) throw new Error('User not found');
    if (s.users.length<=1) throw new Error('Cannot delete the last user');
    // Prevent deleting currently logged-in user without logout
    const cur = getCurrentUser();
    if (cur && cur.u === username) throw new Error('Log out before deleting this user');
    s.users.splice(i,1);
    LS.set('settings', s);
    return listUsers();
  }

  function login(username, password){
    const s = ensureDefaults();
    const ok = (s.users || []).some(it=>it.u===username && it.p===password);
    if (!ok) return false;
    LS.set('currentUser', {u:username, ts: new Date().toISOString(), tz});
    return true;
  }

  function logout(){ LS.del('currentUser') }

  function getCurrentUser(){ return LS.get('currentUser') }

  // expose
  const api = {
    ensureDefaults, getSettings, saveSettings,
    listUsers, addUser, deleteUser,
    login, logout, getCurrentUser, tz
  };
  // Make available globally (so your existing inline script can call it)
  window.UserStore = api;
  // Also support ES module import usage
  try { if (typeof export !== 'undefined') export default api } catch(e){}
})();
