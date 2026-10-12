/*
 * Start-up sequence, like a hospital workstation:
 *   1. a mock Windows desktop with the MEDITECH Expanse (green M) icon,
 *   2. the MEDITECH EXPANSE sign-in,
 *   3. "You are logged in as …" with Launch New Session,
 *   4. the Patient Care Status Board (an empty My List until the student adds patients).
 * Signing out returns to the desktop.
 */
(function () {
  'use strict';
  const esc = U.esc;
  const C = window.EHR_CONFIG;

  const ICONS = [
    { id: 'pc', label: 'This PC', glyph: '<svg viewBox="0 0 40 40"><rect x="5" y="7" width="30" height="20" rx="2" fill="#5fb3f2" stroke="#1d5f99" stroke-width="2"/><path d="M15 33h10M20 27v6" stroke="#cfd8e3" stroke-width="3"/></svg>' },
    { id: 'bin', label: 'Recycle Bin', glyph: '<svg viewBox="0 0 40 40"><path d="M11 12h18l-2 22H13z" fill="#e8eef5" stroke="#8aa1b8" stroke-width="2"/><path d="M9 12h22M16 8h8" stroke="#8aa1b8" stroke-width="2"/></svg>' },
    { id: 'meditech', label: 'MEDITECH Expanse', glyph: '<span class="dk-m" aria-hidden="true">M</span>' },
    { id: 'edge', label: 'Microsoft Edge', glyph: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#1f9fd8"/><path d="M8 22c2-10 20-12 24-2-6-4-14-2-14 4 0 5 7 7 13 4-6 8-22 6-23-6z" fill="#3ccf8e"/></svg>' },
    { id: 'word', label: 'Word', glyph: '<svg viewBox="0 0 40 40"><rect x="7" y="6" width="26" height="28" rx="3" fill="#2b65c6"/><path d="M12 14l3 12 3-9 3 9 3-12" stroke="#fff" stroke-width="2.4" fill="none"/></svg>' },
    { id: 'folder', label: 'Clinical Resources', glyph: '<svg viewBox="0 0 40 40"><path d="M5 12h12l3 3h15v17H5z" fill="#f4c542" stroke="#c99a12" stroke-width="1.5"/></svg>' }
  ];

  const clockText = () => {
    const d = new Date();
    return `<div>${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div><div>${d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</div>`;
  };

  Screens.desktop = {
    render() {
      return `<div class="dk" role="application" aria-label="Workstation desktop">
        <div class="dk-icons">${ICONS.map(i => `<button type="button" class="dk-icon" data-icon="${i.id}" aria-label="${esc(i.label)}${i.id === 'meditech' ? ' — double-click to open' : ''}">
          <span class="dk-glyph">${i.glyph}</span><span class="dk-label">${esc(i.label)}</span></button>`).join('')}</div>
        <div class="dk-hint" role="note">Double-click <strong>MEDITECH Expanse</strong> to start (on a tablet, tap it).</div>
        <div class="dk-taskbar">
          <span class="dk-start" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M2 3.5l7-1v7H2zM10 2.3 18 1v8.5h-8zM2 10.5h7v7l-7-1zM10 10.5h8V19l-8-1.3z" fill="#fff"/></svg></span>
          <span class="dk-search">🔍 Type here to search</span>
          <span class="dk-pin" aria-hidden="true"><span class="dk-m dk-m-sm">M</span></span>
          <span class="dk-tray" id="dk-clock">${clockText()}</span>
        </div>
      </div>`;
    },
    bind(root) {
      const icons = root.querySelectorAll('.dk-icon');
      const open = id => {
        if (id !== 'meditech') { UI.toast('Only MEDITECH Expanse is available on this training workstation.', 'info'); return; }
        const el = root.querySelector('.dk');
        el.insertAdjacentHTML('beforeend', '<div class="dk-splash" role="status"><div class="dk-splash-card"><span class="dk-m">M</span><div><strong>MEDITECH Expanse</strong><div class="muted small">Starting…</div></div></div></div>');
        setTimeout(() => { location.hash = '#/signin'; }, 900);
      };
      icons.forEach(b => {
        b.addEventListener('click', () => { icons.forEach(x => x.classList.toggle('on', x === b)); });
        b.addEventListener('dblclick', () => open(b.dataset.icon));
        b.addEventListener('keydown', e => { if (e.key === 'Enter') open(b.dataset.icon); });
        // Tablets: one tap opens.
        b.addEventListener('touchend', e => { e.preventDefault(); icons.forEach(x => x.classList.toggle('on', x === b)); open(b.dataset.icon); });
      });
      root.querySelector('.dk').addEventListener('click', e => { if (!e.target.closest('.dk-icon')) icons.forEach(x => x.classList.remove('on')); });
      const tick = setInterval(() => { const c = document.getElementById('dk-clock'); if (c) c.innerHTML = clockText(); else clearInterval(tick); }, 15000);
    }
  };

  // After sign-in: "You are logged in as …" with the environment and Launch New Session.
  Screens.launch = {
    render() {
      const s = Store.session();
      return `<div class="xp">
        <div class="xp-logo"><div class="xp-brand">MEDITECH</div><div class="xp-name">E X P A N S E</div></div>
        <p class="xp-who">You are logged in as "${esc(s.name)}"</p>
        <div class="xp-panel">
          <div class="xp-env"><span class="xp-minus" aria-hidden="true">⊖</span> ${esc(C.hospitalName)} Test</div>
          <button type="button" class="xp-launch" data-action="launch"><span class="xp-plus" aria-hidden="true">+</span> Launch New Session</button>
        </div>
        <button type="button" class="xp-signout" data-action="signout">Not you? Sign out</button>
      </div>`;
    },
    bind(root) {
      root.querySelector('[data-action="launch"]').addEventListener('click', () => {
        const s = Store.session(); s.launched = true; Store.setSession(s);
        location.hash = '#/census';
        App.render();
      });
      root.querySelector('[data-action="signout"]').addEventListener('click', () => { Store.clearSession(); location.hash = '#/'; App.render(); });
    }
  };
})();
