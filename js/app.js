/* App shell: Expanse-style toolbar, folder tabs, patient side panel, routing. */
(function () {
  'use strict';
  const esc = U.esc;
  const C = window.EHR_CONFIG;

  // Older Safari (iOS 12–14.0) ignores flex `gap`; flag it so styles.css can space items with margins.
  (function () {
    const f = document.createElement('div');
    f.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';
    f.appendChild(document.createElement('div')); f.appendChild(document.createElement('div'));
    document.documentElement.appendChild(f);
    if (f.scrollHeight !== 1) document.documentElement.classList.add('no-flexgap');
    f.remove();
  })();

  // Chart tabs laid out like MEDITECH Expanse: 3 rows x 4 tabs. Each tab holds
  // one or more screens (shown as sub-tabs). null = empty tab slot.
  const GROUPS = [
    [{ label: 'Diagnostics', views: ['results'] }, { label: 'Provider Notes', views: ['provnotes'] },
     { label: 'Nurse/Allied Health', views: ['assess', 'notes'] }, { label: 'Medications', views: ['meds'] }],
    [{ label: 'History & Problems', views: ['history'] }, { label: 'Administrative', views: ['admin'] },
     { label: 'Other Clinical', views: ['documents', 'report'] }, { label: 'Workload Items', views: ['worklist'] }],
    [{ label: 'Summary', views: ['summary'] }, { label: 'Activity', views: ['activity'] },
     { label: 'Flowsheets', views: ['vitals', 'io', 'heparin'] }, { label: 'Health Mgmt', views: ['careplan'] }]
  ];
  const TABS = GROUPS.flat().filter(Boolean).flatMap(g => g.views).concat(['worklist', 'orders', 'tar', 'mar']); // worklist, orders, TAR, and MAR are their own screens
  const viewsOf = (g, p) => g.views.filter(v => v !== 'heparin' || p.heparinFlowsheet);
  const groupOf = tab => GROUPS.flat().find(g => g && g.views.includes(tab));

  const ICON = {
    back: '<path d="M10 4 4 10l6 6M4 10h12"/>',
    home: '<path d="M3 10 10 3l7 7M5 8.5V17h4v-5h2v5h4V8.5"/>',
    workload: '<rect x="3" y="4" width="14" height="13" rx="1"/><path d="M3 8h14M7 2v4M13 2v4M6 11h2M9 11h2M12 11h2M6 14h2M9 14h2"/>',
    chart: '<path d="M3 5h5l2 2h7v10H3z"/>',
    document: '<path d="M5 2h7l4 4v12H5z"/><path d="M12 2v4h4M8 10h5M8 13h5"/>',
    orders: '<rect x="4" y="3" width="12" height="15" rx="1"/><path d="M8 3V2h4v1M7 8h6M7 11h6M7 14h4"/>',
    gear: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8"/>',
    suspend: '<circle cx="10" cy="10" r="7"/><path d="M7.5 7.5l5 5M12.5 7.5l-5 5"/>',
    discharge: '<circle cx="8" cy="5" r="2.2"/><path d="M8 7.5v5l-3 4M8 12.5l3 4M5 10h7M13 9h4M15 7l2 2-2 2"/>',
    menu: '<path d="M4 5h12M4 10h12M4 15h12"/>',
    more: '<circle cx="5" cy="10" r="1.3"/><circle cx="10" cy="10" r="1.3"/><circle cx="15" cy="10" r="1.3"/>',
    help: '<circle cx="10" cy="10" r="7.5"/><path d="M7.8 7.8a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.5v.6M10 14.6v.2"/>'
  };
  const svg = name => `<svg viewBox="0 0 20 20" aria-hidden="true">${ICON[name]}</svg>`;
  const tool = (name, label, href, attrs, cls) => `<a class="tb-btn${cls ? ' ' + cls : ''}" href="${href}" ${attrs || ''}>${svg(name)}<span>${esc(label)}</span></a>`;

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    return { page: parts[0] || 'census', pid: parts[1], tab: parts[2] || 'summary' };
  }

  // Toolbar laid out like MEDITECH Expanse: Return To (green E) and Home on the left; Chart, Document,
  // Orders, Discharge in the middle; Workload, Menu, More, Help, User, Close on the right.
  // On the status board, the middle buttons act on the selected patient.
  function toolbar(p, mode) {
    const s = Store.session();
    const clock = p ? p.clock.now() : Date.now();
    const pid = p ? p.id : '';
    const initials = (s.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase();
    const open = Store.openCharts().map(id => Model.base(id)).filter(Boolean);
    const center = (name, label, act, on) => p
      ? (act === 'discharge' ? `<a class="tb-btn" href="#" data-act="discharge">${svg(name)}<span>${label}</span></a>`
        : tool(name, label, act === 'chart' ? `#/patient/${esc(pid)}/${App.lastChartTab && App.lastChartTab[pid] || 'summary'}` : `#/patient/${esc(pid)}/${act}`, on ? 'aria-current="page"' : '', on ? 'tb-on' : ''))
      : `<a class="tb-btn" href="#" data-boardact="${act}" title="Select a patient on the list first">${svg(name)}<span>${label}</span></a>`;
    return `<header class="toolbar">
      <div class="tb-group">
        <div class="tb-split">
          <a class="tb-btn tb-return" href="#" data-menu aria-haspopup="true"><span class="tb-e" aria-hidden="true">E</span><span>Return To</span></a>
          <div class="tb-menu tb-return-menu" hidden role="menu">
            <div class="ml-menu-h">HOME SCREENS</div>
            <a role="menuitem" href="#/census">Patient Care Status Board</a>
            <div class="ml-menu-h">OTHER ITEMS</div>
            ${open.length ? open.map(b => `<div class="rt-item"><a role="menuitem" href="#/patient/${esc(b.id)}/summary"><strong>${esc(b.name.last)},${esc(b.name.first)}</strong><small>MRN ${esc(b.mrn)} · ${esc(b.unit)}</small></a><button type="button" class="rt-x" data-closechart="${esc(b.id)}" aria-label="Close ${esc(b.name.last)} chart">✕</button></div>`).join('')
              + '<a role="menuitem" href="#" data-closeall>Close All</a>' : '<div class="ml-menu-h rt-none">No open charts</div>'}
          </div></div>
        <div class="tb-split">${tool('home', 'Home', '#/census')}<button class="tb-caret" type="button" data-menu aria-haspopup="true" aria-label="Home menu">▾</button>
          <div class="tb-menu" hidden role="menu">
            <a role="menuitem" href="#/census">Patient Care Status Board</a>
            ${Screens.mode() === 'faculty' ? '<a role="menuitem" href="#/instructor">Instructor Tools</a>' : ''}
          </div></div>
      </div>
      <div class="tb-group tb-center">
        ${center('chart', 'Chart', 'chart', mode === 'chart')}
        ${p ? `<div class="tb-split ${mode === 'document' ? 'tb-split-on' : ''}">${tool('document', 'Document', `#/patient/${esc(pid)}/worklist`)}<button class="tb-caret" type="button" data-menu aria-haspopup="true" aria-label="Documentation menu">▾</button>
          <div class="tb-menu" hidden role="menu">
            <a role="menuitem" href="#/patient/${esc(pid)}/worklist">Worklist</a>
            <a role="menuitem" href="#/patient/${esc(pid)}/mar">Mar</a>
            <a role="menuitem" href="#/patient/${esc(pid)}/tar">Transfusion Administration Record (TAR)</a>
            <a role="menuitem" href="#/patient/${esc(pid)}/careplan">Plan Of Care</a>
            <a role="menuitem" href="#/patient/${esc(pid)}/worklist">Specialty Care</a>
            <a role="menuitem" href="#/patient/${esc(pid)}/notes" data-docmenu="note">Write Note</a>
          </div></div>` : center('document', 'Document', 'worklist')}
        ${center('orders', 'Orders', 'orders', mode === 'orders')}
        ${center('discharge', 'Discharge', 'discharge')}
      </div>
      <div class="tb-group tb-right">
        <div class="tb-info"><div class="tb-clock"><span id="clock">${U.fmtDT(clock)}</span></div></div>
        ${p ? tool('workload', 'Workload', `#/patient/${esc(pid)}/worklist`) : `<a class="tb-btn" href="#" data-boardact="worklist">${svg('workload')}<span>Workload</span></a>`}
        <div class="tb-split"><a class="tb-btn" href="#" data-menu aria-haspopup="true">${svg('menu')}<span>Menu</span></a>
          <div class="tb-menu tb-menu-right" hidden role="menu">
            <a role="menuitem" href="#/census">Patient Care Status Board</a>
            ${p ? `<a role="menuitem" href="#/patient/${esc(pid)}/report">Chart Report</a>` : ''}
            <a role="menuitem" href="labels.html" target="_blank" rel="noopener">Print Wristbands &amp; Med Labels</a>
            ${Screens.mode() === 'faculty' ? '<a role="menuitem" href="#/instructor">Instructor Tools</a>' : ''}
          </div></div>
        <div class="tb-split"><a class="tb-btn" href="#" data-menu aria-haspopup="true">${svg('more')}<span>More</span></a>
          <div class="tb-menu tb-menu-right" hidden role="menu">
            <a role="menuitem" href="#" data-act="refresh">Refresh</a>
            <a role="menuitem" href="#" data-act="print">Print This Screen</a>
          </div></div>
        <a class="tb-btn" href="#" data-act="help">${svg('help')}<span>Help</span></a>
        <div class="tb-split tb-mode"><a class="tb-btn" href="#" data-menu aria-haspopup="true"><span class="tb-initials" aria-hidden="true">${esc(initials)}</span><span>User</span></a>
          <div class="tb-menu tb-menu-right tb-mode-menu" hidden role="menu">
            <div class="ml-menu-h tb-whoami"><strong>${esc(s.name)}, ${esc(s.cred)}</strong>${s.group ? `<br>${esc(s.group)}` : ''}<br>${esc(C.environmentName)}</div>
            <div class="ml-menu-h">Chart mode</div>
            ${['student', 'observer', 'faculty'].map(m => `<a role="menuitem" href="#" data-setmode="${m}" class="${Screens.mode() === m ? 'ml-on' : ''}">${Screens.MODE_LABEL[m]}${m === 'observer' ? ' (view only)' : m === 'faculty' ? ' (PIN)' : ' (documenting)'}</a>`).join('')}
            <a role="menuitem" href="#" data-action="logout">Sign Out</a>
          </div></div>
        <a class="tb-btn" href="#" data-act="close">${svg('suspend')}<span>Close</span></a>
      </div>
    </header>
    <div class="sim-strip">TRAINING ENVIRONMENT — TEST ACCOUNTS ONLY · NOT A REAL MEDICAL RECORD</div>
    ${Screens.mode() === 'observer' ? '<div class="observer-strip" role="status">OBSERVER MODE — VIEW ONLY. You can review the chart but cannot document, give medications, or acknowledge orders or results.</div>' : ''}
    ${Screens.mode() === 'faculty' ? '<div class="faculty-strip" role="status">FACULTY MODE — instructor tools unlocked. Switch back to Student before handing this device to a student.</div>' : ''}`;
  }

  const HELP = `<ul class="help-list">
      <li><strong>Starting up</strong> — on the desktop, double-click (or tap) <strong>MEDITECH Expanse</strong>, sign in, then select <strong>Launch New Session</strong>. Signing out returns to the desktop.</li>
      <li><strong>Return To (green E)</strong> — go back to the Patient Care Status Board or to any chart you have open. ✕ closes one chart; Close All closes them all.</li>
      <li><strong>Status board</strong> — your list starts empty. Select the <strong>☰</strong> menu next to your name, then <em>Add Patients…</em> (filter by name, MRN, room, or unit). The same menu removes the selected patient or clears your list. ▸ on a row shows more about the patient. Select a row, then use Chart, Document, or Orders, or double-click it.</li>
      <li><strong>Find Patient</strong> — search all test accounts by name, MRN, account number, unit, or room.</li>
      <li><strong>Chart</strong> — folder tabs on the left; patient summary on the right. <em>Search Patient's Chart</em> searches every part of the chart (notes, orders, medications, results, vitals, history, allergies, documents).</li>
      <li><strong>Document ▾</strong> — Worklist, MAR, TAR, Plan of Care, Write Note. On the MAR scan the wristband, scan every medication, then Save and Document.</li>
      <li><strong>User</strong> — your name, chart mode, and Sign Out. <strong>Close</strong> closes the open chart (on the status board, it signs you out).</li>
    </ul>`;

  function tabs(p, doc, tab) {
    const counts = {
      orders: Model.unackedOrders(p, doc).length,
      results: Model.unreviewedResults(p, doc).length,
      meds: (c => c.due + c.overdue)(Model.dueCounts(p, doc))
    };
    const active = groupOf(tab);
    // Like Expanse, the row holding the active tab moves down next to the page and turns tan.
    const activeRow = GROUPS.findIndex(r => r.includes(active));
    const ordered = GROUPS.filter((_, i) => i !== activeRow).concat([GROUPS[activeRow]]);
    const cell = g => {
      if (!g) return '<span class="ftab ftab-empty" aria-hidden="true"></span>';
      const n = viewsOf(g, p).reduce((a, v) => a + (counts[v] || 0), 0);
      const on = g === active;
      return `<a href="#/patient/${esc(p.id)}/${viewsOf(g, p)[0]}" class="ftab ${on ? 'ftab-on' : ''}" ${on ? 'aria-current="page"' : ''}><span>${esc(g.label)}</span>${n ? `<span class="count">${n}</span>` : ''}</a>`;
    };
    return `<nav class="folder-tabs" aria-label="Chart sections">${ordered.map((r, i) =>
      `<div class="tab-row ${i === ordered.length - 1 ? 'tab-row-on' : ''}">${r.map(cell).join('')}</div>`).join('')}</nav>`;
  }

  function paneHead(p, doc, tab) {
    const g = groupOf(tab);
    const views = viewsOf(g, p);
    const sub = views.length > 1 ? `<div class="subtabs">${views.map(v => `<a href="#/patient/${esc(p.id)}/${v}" class="subtab ${v === tab ? 'subtab-on' : ''}">${esc(Views[v].label)}</a>`).join('')}</div>` : '';
    return `<div class="pane-head"><span class="pane-up" aria-hidden="true">↑</span><h1 class="view-title">${esc(g.label)}</h1>
      <span class="pane-icons" aria-hidden="true"><svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3 8h14M10 11v3M8.5 12.5 10 11l1.5 1.5"/></svg>${svg('gear')}</span></div>${sub}`;
  }

  function sidePanel(p) {
    const initials = (p.name.first[0] + p.name.last[0]).toUpperCase();
    const bmi = Model.bmi(p);
    const allergies = p.nkda || !(p.allergies || []).length
      ? '<p>No Known Drug Allergies</p>'
      : p.allergies.map(a => `<p class="al">${esc(a.agent)} <span class="muted">— ${esc(a.reaction)}${a.severity ? ', ' + esc(a.severity) : ''}</span></p>`).join('');
    const indicators = [
      `<span class="code ${p.codeStatus === 'DNR' ? 'code-dnr' : ''}">${esc(p.codeStatus)}</span>`,
      p.isolation && p.isolation !== 'None' && p.isolation !== 'Standard' ? `<p>Isolation: ${esc(p.isolation)}</p>` : '',
      ...(p.flags || []).map(f => `<p>${esc(f)}</p>`)
    ].join('');
    const problems = [p.admitDx, ...(p.pmh || [])].map(x => `<p>${esc(x)}</p>`).join('');
    const resus = /not documented/i.test(p.codeStatus || '') ? '<div class="resus">Resus Status Needs Review</div>' : '';
    const bsa = Model.bsa(p);
    return `<aside class="side" aria-label="Patient">
      <div class="side-id"><button class="side-refresh" type="button" title="Refresh" onclick="App.render()" aria-label="Refresh chart">↻</button>
        <div class="avatar" aria-hidden="true">${esc(initials)}</div>
        <div><div class="side-name">${esc(p.name.last)},${esc(p.name.first)}</div>
          <div>${esc(p.age.replace(' years', ''))}, ${esc(p.sex)} · ${esc(U.fmtDOB(p.dob))}</div>
          <div>MRN# ${esc(p.mrn)}</div></div>
      </div>${resus}
      <div class="side-facts">
        <div>${esc(Model.location(p))}</div>
        <div class="side-2col"><span>${p.heightCm ? (p.heightCm / 100).toFixed(2) + ' m' : 'Ht —'}<br>${p.weightKg ? esc(p.weightKg) + ' kg' : 'Wt —'}</span><span>${bsa ? 'BSA: ' + bsa + ' m²' : ''}<br>${bmi ? 'BMI: ' + bmi + ' kg/m²' : ''}</span></div>
        <div class="side-cc">${esc(Model.chiefComplaint(p))}</div>
        <div class="side-boxes"><span>Acc#<br><strong>${esc(Model.account(p))}</strong></span><span class="side-code ${p.codeStatus === 'DNR' ? 'code-dnr' : ''}">${esc(p.codeStatus)}</span></div>
        <div class="side-admit">Admit: ${esc(U.fmtDate(p.admitTime))} · ${esc(p.attending)}</div>
      </div>
      <form class="side-search" role="search"><span aria-hidden="true">🔍</span><input name="q" placeholder="Search Patient's Chart" autocomplete="off" aria-label="Search Patient's Chart"></form>
      <details class="side-sec" open><summary>Special Indicators</summary>${indicators}</details>
      <details class="side-sec" open><summary>Allergies</summary>${allergies}</details>
      <details class="side-sec" open><summary>Problems</summary>${problems}</details>
    </aside>`;
  }

  const App = {
    current: null,
    render() {
      const app = document.getElementById('app');
      const r = route();
      const s = Store.session();
      App.current = null;
      // Start-up: desktop → Launch New Session → status board.
      if (!Store.session()) {
        // No sign-in screen: the desktop's MEDITECH icon starts the session.
        app.innerHTML = Screens.desktop.render();
        Screens.desktop.bind(app);
        document.title = 'Workstation';
        return;
      }
      if (!Store.session().launched) {
        app.innerHTML = Screens.launch.render();
        Screens.launch.bind(app);
        document.title = 'MEDITECH Expanse';
        return;
      }
      if (r.page === 'patient' && r.pid) {
        const base = Model.base(r.pid);
        if (!base) { location.hash = '#/census'; return; }
        if (!Screens.canSee(base)) {
          location.hash = '#/census';
          UI.toast('That test account is not available.', 'warn');
          return;
        }
        const p = Model.get(r.pid);
        const tab = TABS.includes(r.tab) && (r.tab !== 'heparin' || p.heparinFlowsheet) ? r.tab : 'summary';
        const doc = Store.doc(p.id);
        const view = Views[tab];
        App.current = p;
        if (!Store.openCharts().includes(p.id)) Store.setOpenCharts(Store.openCharts().concat(p.id));
        const solo = tab === 'worklist' || tab === 'orders' || tab === 'tar' || tab === 'mar';
        if (!solo) { App.lastChartTab = App.lastChartTab || {}; App.lastChartTab[p.id] = tab; }
        const scroll = window.scrollY;
        app.innerHTML = tab === 'worklist' || tab === 'tar' || tab === 'mar'
          // The documentation worklist is a separate screen (no chart folders); Chart returns to the tabs.
          ? `${toolbar(p, 'document')}<main class="content worklist-screen" id="content">${view.render(p, doc)}</main>`
          : tab === 'orders'
          // Orders open from the Orders toolbar button, also outside the chart folders.
          ? `${toolbar(p, 'orders')}<main class="content worklist-screen" id="content">${Views.worklist.band(p)}${view.render(p, doc)}</main>`
          : `${toolbar(p, 'chart')}<div class="chart">
          <div class="chart-main">${tabs(p, doc, tab)}
            <main class="content" id="content">${paneHead(p, doc, tab)}${view.render(p, doc)}</main>
          </div>${sidePanel(p)}</div>`;
        if (view.bind) view.bind(app.querySelector('#content'), p, doc);
        const ss = app.querySelector('.side-search');
        if (ss) ss.addEventListener('submit', e => { e.preventDefault(); Views.chartSearch.open(p, ss.q.value); });
        document.title = `${p.name.last}, ${p.name.first} — ${view.label} · ${C.systemName}`;
        if (App._lastKey === location.hash) window.scrollTo(0, scroll);
      } else if (r.page === 'instructor') {
        if (!Store.instructorUnlocked()) {
          location.hash = '#/census';
          Screens.unlock(() => { location.hash = '#/instructor'; });
          return;
        }
        app.innerHTML = toolbar(null) + `<main class="content solo">${Screens.instructor.render()}</main>`;
        Screens.instructor.bind(app);
        document.title = `Instructor Tools · ${C.systemName}`;
      } else {
        app.innerHTML = toolbar(null) + `<main class="content solo board">${Screens.census.render()}</main>`;
        Screens.census.bind(app);
        document.title = `Census · ${C.hospitalName}`;
      }
      App._lastKey = location.hash;
      bindToolbar(app);
    }
  };

  // Close one open chart (Return To ✕, or Close in the toolbar).
  function closeChart(id) {
    Store.setOpenCharts(Store.openCharts().filter(x => x !== id));
    if (App.lastChartTab) delete App.lastChartTab[id];
  }

  function bindToolbar(app) {
    // Drop-down menus: Return To, Home ▾, Document ▾, Menu, More, User.
    const closeMenus = () => app.querySelectorAll('.toolbar .tb-menu').forEach(m => { m.hidden = true; });
    app.querySelectorAll('.toolbar [data-menu]').forEach(btn => {
      const menu = btn.closest('.tb-split').querySelector('.tb-menu');
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const show = menu.hidden;
        closeMenus();
        menu.hidden = !show;
        btn.setAttribute('aria-expanded', String(show));
        if (show) setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
      });
    });
    app.querySelectorAll('[data-docmenu="note"]').forEach(a => a.addEventListener('click', () => {
      if (App.current) { const pt = App.current; setTimeout(() => Views.notes.write(Model.get(pt.id), 'Nursing Narrative'), 50); }
    }));
    app.querySelectorAll('[data-setmode]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); closeMenus(); Screens.setMode(a.dataset.setmode); }));
    app.querySelectorAll('[data-closechart]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const id = b.dataset.closechart;
      closeChart(id);
      if (App.current && App.current.id === id) location.hash = '#/census'; else App.render();
    }));
    const all = app.querySelector('[data-closeall]');
    if (all) all.addEventListener('click', e => { e.preventDefault(); Store.setOpenCharts([]); App.lastChartTab = {}; if (App.current) location.hash = '#/census'; else App.render(); });
    // Status board: Chart / Document / Orders / Workload act on the selected patient.
    app.querySelectorAll('[data-boardact]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const id = Screens.census.selected();
      if (!id) { UI.toast('Select a patient on the list first.', 'warn'); return; }
      const act = b.dataset.boardact;
      if (act === 'discharge') return discharge(Model.get(id));
      location.hash = `#/patient/${id}/${act === 'chart' ? 'summary' : act}`;
    }));
    app.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault(); closeMenus();
      const act = b.dataset.act;
      if (act === 'refresh') App.render();
      else if (act === 'print') window.print();
      else if (act === 'help') UI.modal({ title: 'Help — Using the Training EMR', wide: true, body: HELP, buttons: [{ label: 'Close' }] });
      else if (act === 'discharge') discharge(App.current);
      else if (act === 'close') {
        if (App.current) { closeChart(App.current.id); location.hash = '#/census'; }
        else signOut();
      }
    }));
    app.querySelectorAll('[data-action="logout"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); closeMenus(); signOut(); }));
    document.body.classList.toggle('mode-observer', Screens.mode() === 'observer');
  }

  function signOut() {
    UI.confirm('Sign Out', 'Sign out of the training EMR? Your documentation stays saved on this device.', () => {
      Store.clearSession(); Store.setInstructor(false); location.hash = '#/'; App.render();
    }, 'Sign Out');
  }

  function discharge(p) {
    if (!p) return;
    UI.modal({ title: 'Discharge — ' + p.name.last + ', ' + p.name.first,
      body: '<p>Discharge is not turned on for test accounts in this training environment, so every account stays available for the next student.</p>',
      buttons: [{ label: 'OK' }] });
  }

  window.App = App;

  // Observer mode: block every charting or acknowledging action before its handler runs.
  const BLOCK = ['[data-ack]', '[data-action="ackall"]', '[data-action="verbal"]', '[data-action="new"]', '[data-dose]', '[data-prn]', '[data-infusion]', '[data-titrate]',
    '[data-effect]', '[data-err]', '[data-tar]', '[data-review]', '[data-wl="document"]', '.wl-row', '[data-docmenu="note"]', '[data-add]', '[data-eval]'].join(',');
  const observing = () => Screens.mode() === 'observer';
  document.addEventListener('click', e => {
    if (!observing() || !e.target.closest) return;
    const hit = e.target.closest(BLOCK);
    if (hit && hit.closest('#app, #modal-root')) {
      e.preventDefault(); e.stopImmediatePropagation();
      UI.toast('Observer mode is view only. You cannot document or acknowledge.', 'warn');
    }
  }, true);
  document.addEventListener('submit', e => {
    if (!observing() || !e.target.closest('#app, #modal-root') || e.target.closest('.login-card')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    UI.toast('Observer mode is view only. You cannot document.', 'warn');
  }, true);
  window.addEventListener('hashchange', () => App.render());
  // Keep the clock current; refresh due/overdue colors each minute.
  let lastMinute = null;
  setInterval(() => {
    const el = document.getElementById('clock');
    const now = App.current ? App.current.clock.now() : Date.now();
    if (el) el.textContent = U.fmtDT(now);
    const m = Math.floor(now / 60000);
    if (lastMinute != null && m !== lastMinute && App.current && !document.querySelector('.modal-backdrop') && !(document.activeElement && document.activeElement.closest('form'))) App.render();
    lastMinute = m;
  }, 5000);
  // Sync if another tab (e.g., instructor window) changes storage.
  window.addEventListener('storage', () => { if (!document.querySelector('.modal-backdrop')) App.render(); });
  document.addEventListener('DOMContentLoaded', () => App.render());
})();
