
/**
 * capture-store.js
 * LocalStorage-backed Outbox & Draft persistence, per-user namespacing.
 * Mirrors your current LS key structure so you can drop it in with minimal changes.
 *
 * Usage (in index.html):
 *   <script type="module" src="capture-store.js"></script>
 *   <script>
 *     const out = CaptureStore.getOutbox();
 *     CaptureStore.queue(payload);
 *   </script>
 */
(function(){
  'use strict';
  const tz = 'Africa/Johannesburg';

  const LS = {
    get(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null }catch(e){ return null } },
    set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} },
    del(k){ try{ localStorage.removeItem(k) }catch(e){} },
  };

  function getCurrentUser(){
    return (window.UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser()) || LS.get('currentUser');
  }
  function userKey(k){
    const u = getCurrentUser();
    return (u && u.u) ? (k + '@' + u.u) : ('guest:' + k);
  }

  // Outbox
  function getOutbox(){ return LS.get(userKey('outbox')) || [] }
  function queue(payload){
    const out = getOutbox();
    out.push(payload);
    LS.set(userKey('outbox'), out);
    return out.length;
  }
  function shiftOne(){
    const out = getOutbox();
    if (out.length===0) return null;
    const first = out.shift();
    LS.set(userKey('outbox'), out);
    return first;
  }
  function clearOutbox(){ LS.del(userKey('outbox')) }
  function outboxCount(){ return getOutbox().length }

  // Draft
  function saveDraft(obj){ LS.set(userKey('draft'), obj || {}) }
  function loadDraft(){ return LS.get(userKey('draft')) || null }
  function clearDraft(){ LS.del(userKey('draft')) }

  // Sent log (YYYY-MM-DD in en-CA)
  function incSentCount(){
    const today = new Date().toLocaleDateString('en-CA',{timeZone:tz});
    const log = LS.get(userKey('sentLog')) || {};
    log[today] = (log[today] || 0) + 1;
    LS.set(userKey('sentLog'), log);
    return log[today];
  }
  function getSentCount(dateStr){
    const log = LS.get(userKey('sentLog')) || {};
    const key = dateStr || new Date().toLocaleDateString('en-CA',{timeZone:tz});
    return log[key] || 0;
  }

  // GPS
  function setGPS(g){ LS.set(userKey('lastGPS'), g) }
  function getGPS(){ return LS.get(userKey('lastGPS')) || null }

  // expose
  const api = {
    tz,
    // outbox
    getOutbox, queue, shiftOne, clearOutbox, outboxCount,
    // draft
    saveDraft, loadDraft, clearDraft,
    // sent log
    incSentCount, getSentCount,
    // gps
    setGPS, getGPS,
    // helper
    userKey
  };
  window.CaptureStore = api;
})();
