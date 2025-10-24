
/**
 * settings-users-endpoint.js
 * Injects "Users Webhook URL" into your Settings dialog and persists to settings.usersEndpoint
 */
(function(){
  'use strict';
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn) }
  ready(function(){
    const dlg = document.querySelector('#settings') || document.querySelector('dialog') || document.body;
    const form = dlg.querySelector('form') || dlg;
    if(!form) return;

    const s = (window.UserStore && UserStore.getSettings && UserStore.getSettings()) || JSON.parse(localStorage.getItem('settings')||'{}');
    const block = document.createElement('div');
    block.style.marginTop='12px';
    block.innerHTML = `
      <div style="margin:10px 0;">
        <label style="display:block;margin-bottom:6px;font-weight:600;">Users Webhook URL</label>
        <input id="usersEndpointInput" placeholder="https://your-n8n/webhook/users" style="width:100%;padding:8px;border-radius:8px;border:1px solid #334155;background:#0b1020;color:#e5e7eb;" />
        <div style="font-size:12px;color:#94a3b8;margin-top:6px;">Used for hashed user list (GET/PUT to Drive via n8n).</div>
      </div>`;
    const btnRow = form.querySelector('.btns, button[type=\"submit\"], button.primary') || form.lastElementChild;
    if(btnRow && btnRow.parentElement){ btnRow.parentElement.insertBefore(block, btnRow); } else { form.appendChild(block) }

    const input = form.querySelector('#usersEndpointInput');
    if(input) input.value = (s.usersEndpoint || '').trim();

    form.addEventListener('submit', function(){
      const url = (input && input.value || '').trim();
      if(window.UserStore && UserStore.setUsersEndpoint) UserStore.setUsersEndpoint(url);
      else { const ss = JSON.parse(localStorage.getItem('settings')||'{}'); ss.usersEndpoint = url; localStorage.setItem('settings', JSON.stringify(ss)); }
    }, true);
  });
})();
