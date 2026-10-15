/* Screens outside a chart: sign-in, census, instructor tools. */
(function () {
  'use strict';
  const esc = U.esc;
  const C = window.EHR_CONFIG;
  window.Screens = {};

  const allergyText = p => p.nkda || !(p.allergies || []).length ? 'NKDA' : p.allergies.map(a => a.agent).join(', ');

  // Training environment: every test account is open to every user (no levels or experiences).
  Screens.experience = () => 'all';
  Screens.canSee = () => true;
  // Chart mode: faculty (PIN unlocked), observer (view only), or student (documenting).
  Screens.mode = () => Store.instructorUnlocked() ? 'faculty' : ((Store.session() || {}).observer ? 'observer' : 'student');
  Screens.MODE_LABEL = { student: 'Student', observer: 'Observer', faculty: 'Faculty' };

  // Switch modes. Faculty needs the PIN; leaving Observer also needs the PIN so observers can't start charting on their own.
  Screens.setMode = function (to) {
    const from = Screens.mode();
    if (to === from) return;
    const apply = () => {
      const s = Store.session();
      if (to === 'faculty') { Store.setInstructor(true); }
      else { Store.setInstructor(false); if (s) { s.observer = to === 'observer'; delete s.viewExperience; Store.setSession(s); } }
      UI.toast(`Switched to ${Screens.MODE_LABEL[to]} mode${to === 'observer' ? ' — view only' : ''}.`);
      App.render();
    };
    if (to === 'faculty' || from === 'observer') {
      UI.modal({
        title: to === 'faculty' ? 'Switch to Faculty' : 'Leave Observer Mode',
        body: `<p>${to === 'faculty' ? 'Faculty mode opens the instructor tools.' : 'An instructor must enter the PIN to change an observer to a documenting student.'}</p>
          <label class="field"><span>Instructor PIN</span><input type="password" name="pin" autofocus inputmode="numeric"></label>`,
        buttons: [{ label: 'Cancel' }, { label: 'Switch', cls: 'btn-primary', onClick: api => {
          if (U.formValues(api.el).pin !== String(C.instructorPin)) { UI.formError(api.el.querySelector('.modal-body'), 'Incorrect PIN.'); return false; }
          if (to === 'faculty') { Store.setInstructor(true); UI.toast('Switched to Faculty mode.'); App.render(); }
          else { Store.setInstructor(false); const s = Store.session(); s.observer = false; Store.setSession(s); UI.toast('Switched to Student mode.'); App.render(); }
        } }]
      });
      return;
    }
    apply();
  };

  Screens.experienceLabel = () => C.environmentName;

  /* ---------------- Sign in ---------------- */
  Screens.login = {
    render() {
      return `<div class="xp">
        <div class="xp-logo"><div class="xp-brand">MEDITECH</div><div class="xp-name">E X P A N S E</div></div>
        <form class="login-card xp-card" autocomplete="off">
          <div class="xp-card-h">${esc(C.hospitalName)} Test — Sign In</div>
          <div class="sim-warning">SIMULATION ONLY — Do not enter real patient information.</div>
          <label class="field"><span>User name</span><input name="name" required autofocus placeholder="First Last"></label>
          <label class="field"><span>Role</span><select name="cred">
            <option value="SN">Student Nurse (SN)</option><option value="RN">Registered Nurse (RN)</option>
            <option value="Instructor">Instructor</option></select></label>
          <fieldset class="field login-mode"><legend>Sign in as</legend>
            <label class="check"><input type="radio" name="mode" value="student" checked> <span><strong>Documenting nurse</strong> — I am charting in this simulation</span></label>
            <label class="check"><input type="radio" name="mode" value="observer"> <span><strong>Observer (view only)</strong> — I am watching; I can read the chart but not document or acknowledge</span></label>
          </fieldset>
          <label class="field"><span>Clinical group / cohort (optional)</span><input name="group" placeholder="e.g., Fall cohort — Group A"></label>
          <button class="btn btn-primary btn-block" type="submit">Sign In</button>
          <p class="muted small">Your name is attached to every entry as your electronic signature.</p>
          <p class="muted small">Version ${U.esc(C.version || '')} · <a href="#/" data-action="desktop">Back to desktop</a></p>
        </form></div>`;
    },
    bind(root) {
      root.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const v = U.formValues(e.target);
        if (!v.name) return;
        Store.setSession({ name: v.name, cred: v.cred, group: v.group, observer: v.mode === 'observer', signedIn: Date.now(), launched: false });
        location.hash = '#/launch';
        App.render();
      });
    }
  };

  /* ---------------- Patient Care Status Board (tracker) ----------------
   * Laid out like the Expanse tracker: the user's name with the ☰ box to add test accounts,
   * Find Patient, list tabs (My List, a unit list, More Lists), and one row per patient with
   * an ▸ arrow that drops down more information. */
  let listTab = null;          // 'my' | 'all' | 'unit:<unit name>'
  let selected = null;
  const expanded = {};
  const units = () => Array.from(new Set(Model.allPatients().map(p => p.unit))).sort();
  const listName = t => t === 'my' ? 'My List' : t === 'all' ? 'All Test Accounts' : t.slice(5);
  const inList = (t, b) => t === 'my' ? Store.myList().includes(b.id) : t === 'all' ? true : b.unit === t.slice(5);
  const short = u => u.replace(/\s+Unit\b/, '').replace(/^Station \d+ — /, '');

  function vitalsStrip(p, doc) {
    const v = k => Model.latestVital(p, doc, k);
    const cell = (label, key, txt) => {
      const x = v(key);
      if (!x) return '';
      const f = Model.flag(p, key, x.value);
      return `<span class="tk-v">${label} <b class="${f ? 'tk-abn' : ''}">${esc(txt ? txt(x.value) : x.value)}${f ? ' ' + f : ''}</b></span>`;
    };
    const sbp = v('sbp'), dbp = v('dbp');
    const bp = sbp && dbp ? `<span class="tk-v">BP <b class="${Model.flag(p, 'sbp', sbp.value) || Model.flag(p, 'dbp', dbp.value) ? 'tk-abn' : ''}">${esc(sbp.value)}/${esc(dbp.value)}</b></span>` : '';
    const o2 = v('o2');
    const out = bp + cell('Pulse', 'hr') + cell('Resp', 'rr') + cell('Temp', 'temp', t => t + 'F') + cell('O2 Sat', 'spo2', t => t + '%') + (o2 ? `<span class="tk-v tk-o2">(${esc(o2.value)})</span>` : '');
    return out || '<span class="muted">No vital signs charted</span>';
  }

  // Pending-work chips on the right of each row, like the tracker's order/result icons.
  function chips(p, doc) {
    const out = [];
    const unacked = Model.unackedOrders(p, doc);
    const byCat = {};
    unacked.forEach(o => { const c = /lab/i.test(o.cat) ? 'LAB' : /imag|radiol|x-?ray/i.test(o.cat) ? 'Xray' : /med/i.test(o.cat) ? 'Med Order' : o.cat; byCat[c] = (byCat[c] || 0) + 1; });
    Object.keys(byCat).forEach(c => out.push(`<span class="tk-chip tk-new" title="${byCat[c]} new ${esc(c)} order(s) to acknowledge">${esc(c)}${byCat[c] > 1 ? ' ' + byCat[c] : ''}</span>`));
    const due = Model.dueCounts(p, doc);
    if (due.overdue) out.push(`<span class="tk-chip tk-late" title="${due.overdue} overdue dose(s)">⏱ MAR</span>`);
    else if (due.due) out.push(`<span class="tk-chip tk-due" title="${due.due} dose(s) due">MAR</span>`);
    else out.push('<span class="tk-chip">MAR</span>');
    Model.unreviewedResults(p, doc).forEach(r => {
      const crit = (r.results || []).some(x => /\*/.test(Model.labFlag(x)));
      out.push(`<span class="tk-chip ${crit ? 'tk-late' : 'tk-new'}" title="New result to review">${crit ? '! ' : ''}${esc(r.panel || r.study)}</span>`);
    });
    const tasks = Views.worklist.due(p, doc);
    if (tasks.length) out.push(`<span class="tk-chip" title="Interventions due">Interventions ${tasks.length}</span>`);
    return out.join('');
  }

  function detail(p, doc) {
    const allergies = p.nkda || !(p.allergies || []).length ? 'No Known Drug Allergies' : p.allergies.map(a => esc(a.agent)).join(', ');
    const recent = [...p.orders].sort((a, b) => b.time - a.time).slice(0, 3);
    const consults = p.orders.filter(o => /consult/i.test(o.cat + ' ' + o.text)).map(o => esc(o.text.replace(/^consult(ation)?:?\s*/i, '')));
    const holds = p.meds.filter(m => m.holdReason && m.status === 'Active').map(m => esc(m.name));
    const next = Views.worklist.due(p, doc)[0];
    const kv = (k, v) => `<div class="tk-k">${esc(k)}</div><div>${v}</div>`;
    return `<div class="tk-detail">
      <div class="tk-dl">${kv('Surveillance', `<strong>${esc(Model.chiefComplaint(p))}</strong>`)}${kv('Account Num', esc(Model.account(p)))}${kv('MRN', esc(p.mrn))}${kv('Language', esc(Model.language(p)))}${kv('Interpreter?', p.interpreter ? 'Y' : 'N')}${kv('Height', p.heightCm ? esc(p.heightCm) + ' cm' : '—')}${kv('Weight', p.weightKg ? esc(p.weightKg) + ' kg' : '—')}</div>
      <div class="tk-dl">${kv('Attending', esc(p.attending))}${kv('Allergies', `<span class="${p.nkda || !(p.allergies || []).length ? '' : 'tk-red'}">${allergies}</span>`)}${kv('Indicators', esc((p.flags || []).join(', ') || '—'))}${kv('Orders', recent.map(o => `<div>${esc(U.fmtDT(o.time))} ${esc(o.text)}</div>`).join('') || '—')}${kv('Consults', consults.join('<br>') || '—')}</div>
      <div class="tk-dl">${kv('Next Task', next ? `${esc(U.fmtTime(next.time))} ${esc(next.text || next.name)}` : '—')}${kv('Meds on Hold', holds.join(', ') || '—')}${kv('Isolation', esc(p.isolation || 'None'))}${kv('Advance Directive', esc(p.advanceDirective || '—'))}</div>
    </div>`;
  }

  function row(base) {
    const p = Model.get(base.id);
    const doc = Store.doc(p.id);
    const allergy = !(p.nkda || !(p.allergies || []).length);
    const initials = (p.name.first[0] + p.name.last[0]).toUpperCase();
    const open = !!expanded[p.id];
    return `<div class="tk-row ${selected === p.id ? 'tk-sel' : ''}" data-open="${esc(p.id)}" tabindex="0">
        <button type="button" class="tk-exp" data-exp="${esc(p.id)}" aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} details for ${esc(p.name.last)}">${open ? '▾' : '▸'}</button>
        <div class="tk-pix"><div class="avatar tk-avatar" aria-hidden="true">${esc(initials)}</div></div>
        <div class="tk-c tk-name"><a href="#/patient/${esc(p.id)}/summary"><strong>${esc(p.name.last)},${esc(p.name.first)}</strong></a>
          <div>${esc(p.age.replace(' years', ''))} ${esc(p.sex)}</div><div>${esc(short(p.unit))}</div><div>${esc(p.room && p.room !== '—' ? p.room : '')}</div></div>
        <div class="tk-c tk-reason"><div class="tk-cc"><strong>${esc(Model.chiefComplaint(p))}</strong></div><div class="muted">${esc(p.attending)}</div><div class="muted">Adm ${esc(U.fmtDate(p.admitTime))}</div></div>
        <div class="tk-c tk-alerts">${(p.flags || []).map(f => `<span class="tk-alert">${esc(f)}</span>`).join('') || '<span class="muted">—</span>'}
          <div class="${(p.homeMeds || []).length ? 'tk-green' : 'muted'}">${(p.homeMeds || []).length ? 'Home Meds Confirmed' : 'No Home Meds'}</div></div>
        <div class="tk-c tk-codec"><div class="${p.codeStatus === 'DNR' ? 'tk-red' : ''}"><strong>${esc(p.codeStatus)}</strong></div>
          <div class="${allergy ? 'tk-red' : ''}">${allergy ? esc(allergyText(p)) : 'NKDA'}</div><div>${esc(p.isolation && !/^(none)$/i.test(p.isolation) ? p.isolation : '')}</div></div>
        <div class="tk-ord"><a class="tk-ordbtn" href="#/patient/${esc(p.id)}/orders" title="Orders">${'<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3" width="12" height="15" rx="1"/><path d="M8 3V2h4v1M7 8h6M7 11h6M7 14h4"/></svg>'}<span>Order</span></a></div>
        <div class="tk-right"><div class="tk-vitals">${vitalsStrip(p, doc)}</div><div class="tk-chips">${chips(p, doc)}</div></div>
      </div>${open ? detail(p, doc) : ''}`;
  }

  function addPatients(then) {
    const mine = Store.myList();
    const bank = Model.allPatients().filter(b => !mine.includes(b.id));
    UI.modal({
      title: 'Add Patients to My List',
      wide: true,
      body: `<div class="form-grid"><label class="field"><span>Search test accounts (name, MRN, account, room)</span><input name="q" autocomplete="off" placeholder="Type to filter"></label>
        <label class="field"><span>Unit</span><select name="unit"><option value="">All units</option>${units().map(u => `<option>${esc(u)}</option>`).join('')}</select></label></div>
        ${bank.length ? `<table class="grid tk-bank"><thead><tr><th></th><th>Name</th><th>Age/Sex</th><th>MRN / Account</th><th>Unit / Room</th><th>Reason for visit</th></tr></thead><tbody>
        ${bank.map(b => `<tr data-unit="${esc(b.unit)}" data-hay="${esc([b.name.last, b.name.first, b.mrn, Model.account(b), b.unit, b.room, b.admitDx].join(' ').toLowerCase())}"><td><input type="checkbox" name="add" value="${esc(b.id)}" aria-label="Add ${esc(b.name.last)}"></td>
          <td><strong>${esc(b.name.last)},${esc(b.name.first)}</strong></td><td>${esc(String(b.age).replace(' years', ''))} ${esc(b.sex)}</td><td>${esc(b.mrn)}<br><small>${esc(Model.account(b))}</small></td><td>${esc(Model.location(b))}</td><td>${esc(b.admitDx)}</td></tr>`).join('')}</tbody></table>`
          : '<p class="empty">Every test account is already on your list.</p>'}`,
      onOpen(api) {
        const q = api.el.querySelector('[name="q"]'), unit = api.el.querySelector('[name="unit"]');
        const filter = () => { const t = q.value.trim().toLowerCase(); api.el.querySelectorAll('tr[data-hay]').forEach(r => { r.hidden = !!(t && !r.dataset.hay.includes(t)) || !!(unit.value && r.dataset.unit !== unit.value); }); };
        q.addEventListener('input', filter); unit.addEventListener('change', filter);
        api.el.querySelectorAll('tr[data-hay]').forEach(r => r.addEventListener('click', e => { if (e.target.type !== 'checkbox') { const c = r.querySelector('input'); c.checked = !c.checked; } }));
      },
      buttons: [{ label: 'Cancel' }, { label: 'Add to My List', cls: 'btn-primary', onClick: api => {
        const ids = Array.from(api.el.querySelectorAll('[name="add"]:checked')).map(c => c.value);
        if (!ids.length) { UI.formError(api.el.querySelector('.modal-body'), 'Check one or more patients to add.'); return false; }
        Store.setMyList(Store.myList().concat(ids));
        listTab = 'my';
        UI.toast(`${ids.length} patient${ids.length > 1 ? 's' : ''} added to My List.`);
        if (then) then();
        App.render();
      } }]
    });
  }

  function findPatient(text) {
    const t = text.trim().toLowerCase();
    if (!t) return;
    const hits = Model.allPatients().filter(b => [b.name.last, b.name.first, b.name.first + ' ' + b.name.last, b.name.last + ',' + b.name.first, b.mrn, Model.account(b), b.unit, b.room].join(' | ').toLowerCase().includes(t));
    const mine = Store.myList();
    UI.modal({
      title: `Find Patient — “${text.trim()}”`,
      wide: true,
      body: hits.length ? `<table class="grid"><thead><tr><th>Name</th><th>Age/Sex</th><th>DOB</th><th>MRN / Account</th><th>Location</th><th></th></tr></thead><tbody>
        ${hits.map(b => `<tr><td><strong>${esc(b.name.last)},${esc(b.name.first)}</strong></td><td>${esc(String(b.age).replace(' years', ''))} ${esc(b.sex)}</td><td>${esc(U.fmtDOB(b.dob))}</td><td>${esc(b.mrn)}<br><small>${esc(Model.account(b))}</small></td><td>${esc(Model.location(b))}</td>
          <td class="nowrap"><a class="btn btn-sm btn-primary" href="#/patient/${esc(b.id)}/summary" data-go>Open Chart</a> ${mine.includes(b.id) ? '<span class="muted small">On My List</span>' : `<button type="button" class="btn btn-sm" data-addone="${esc(b.id)}">Add to My List</button>`}</td></tr>`).join('')}</tbody></table>`
        : '<p class="empty">No test account matches. Search by last name, first name, MRN, account number, unit, or room.</p>',
      onOpen(api) {
        api.el.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', () => api.close()));
        api.el.querySelectorAll('[data-addone]').forEach(b => b.addEventListener('click', () => {
          Store.setMyList(Store.myList().concat(b.dataset.addone));
          b.outerHTML = '<span class="muted small">Added to My List</span>';
          App.render();
        }));
      },
      buttons: [{ label: 'Close' }]
    });
  }

  /* ---------------- Patient hand off and patient summary (half screen, like Expanse) ----------------
   * Open Hand Off and Open Patient Summary split the status board: the patient list narrows on the
   * left and the selected patient's handoff (SBAR note + widgets) or summary opens on the right.
   * The chart is not opened. Handoff notes are saved as nursing notes ("Shift Handoff (SBAR)"). */
  let pane = null;                        // null, 'handoff', or 'summary' (half-screen beside the list)
  let hoEdit = null;                      // { pid, text } while writing a handoff
  const HO_TYPE = 'Shift Handoff (SBAR)';
  const handoffs = doc => doc.notes.filter(e => e.status === 'active' && e.data.type === HO_TYPE).sort((a, b) => b.time - a.time);
  const reviewOf = (doc, id) => doc.ack.find(e => e.status === 'active' && e.data.kind === 'handoff' && e.data.ref === id);

  // A starting SBAR draft from the chart; the nurse edits it before saving.
  function sbarDraft(p, doc) {
    const v = Model.vitals(p, doc).find(r => !r.entry || r.entry.status === 'active') || {};
    const abn = [];
    [...p.labs].sort((a, b) => b.time - a.time).forEach(l => (l.results || []).forEach(r => {
      const f = Model.labFlag(r);
      if (f && !abn.some(x => x.t === r.t)) abn.push({ t: r.t, txt: `${r.t} ${r.v}${r.u ? ' ' + r.u : ''} (${f})` });
    }));
    const allergies = p.nkda || !(p.allergies || []).length ? 'NKDA' : p.allergies.map(a => `${a.agent} (${a.reaction})`).join(', ');
    const next = Views.worklist.due(p, doc).slice(0, 3).map(x => `${U.fmtTime(x.time)} ${x.text || x.name}`);
    return `SITUATION\n${p.name.first} ${p.name.last}, ${String(p.age).replace(' years', '')} ${p.sex}, ${Model.location(p)}. Reason for visit: ${Model.chiefComplaint(p)} — ${p.admitDx}. Code status: ${p.codeStatus}.\n\n`
      + `BACKGROUND\nHistory: ${(p.pmh || []).join(', ') || 'none'}. Allergies: ${allergies}. Admitted ${U.fmtDate(p.admitTime)}; attending ${p.attending}.\n\n`
      + `ASSESSMENT\nLatest vital signs${v.time ? ' (' + U.fmtTime(v.time) + ')' : ''}: T ${v.temp != null ? v.temp : '—'}, HR ${v.hr != null ? v.hr : '—'}, RR ${v.rr != null ? v.rr : '—'}, BP ${v.sbp != null ? v.sbp + '/' + v.dbp : '—'}, SpO2 ${v.spo2 != null ? v.spo2 + '%' : '—'}${v.o2 ? ' on ' + v.o2 : ''}${v.pain != null ? ', pain ' + v.pain + '/10' : ''}.\nAbnormal results: ${abn.slice(0, 6).map(x => x.txt).join('; ') || 'none'}.\n[Add your assessment findings.]\n\n`
      + `RECOMMENDATION\nDue next: ${next.join('; ') || 'nothing scheduled'}.\n[Add pending items, concerns, and what to watch for.]`;
  }

  // part 'vl' = only the vitals and lab widgets (used by the patient summary).
  function hoWidgets(p, doc, part) {
    const rows = Model.vitals(p, doc).filter(r => !r.entry || r.entry.status === 'active');
    const cur = rows[0] || {}, first = rows[rows.length - 1] || {};
    const vrow = (label, key, fmt) => {
      const show = r => r[key] == null || r[key] === '' ? '—' : (fmt ? fmt(r) : r[key]);
      const f = r => key === 'bp' ? (Model.flag(p, 'sbp', r.sbp) || Model.flag(p, 'dbp', r.dbp)) : Model.flag(p, key, r[key]);
      return `<tr><th>${label}</th><td class="${f(first) ? 'ho-abn' : ''}">${esc(String(show(first)))}${f(first) ? ' ' + f(first) : ''}</td><td class="${f(cur) ? 'ho-abn' : ''}">${esc(String(show(cur)))}${f(cur) ? ' ' + f(cur) : ''}</td></tr>`;
    };
    const vitals = rows.length ? `<table class="ho-tbl"><thead><tr><th></th><th>INITIAL<br><small>${esc(U.fmtDT(first.time))}</small></th><th>CURRENT<br><small>${esc(U.fmtDT(cur.time))}</small></th></tr></thead><tbody>
      ${vrow('BP', 'sbp', r => r.sbp != null ? `${r.sbp}/${r.dbp}` : '—')}${vrow('Pulse', 'hr')}${vrow('Resp', 'rr')}${vrow('Temp', 'temp')}${vrow('O2 Sat', 'spo2')}
      <tr><th>O2 Delivery</th><td>${esc(first.o2 || '—')}</td><td>${esc(cur.o2 || '—')}</td></tr></tbody></table>` : '<p class="muted">No vital signs charted.</p>';
    const last = {};
    [...p.labs].sort((a, b) => b.time - a.time).forEach(l => (l.results || []).forEach(r => { if (!last[r.t]) last[r.t] = { r, time: l.time }; }));
    const labs = Object.keys(last).length ? `<table class="ho-tbl">${Object.keys(last).map(t => { const { r, time } = last[t]; const f = Model.labFlag(r); const ref = Model.labRef(r);
      return `<tr><th>${esc(t)}${ref ? `<br><small>(${esc(ref)})</small>` : ''}</th><td class="${f ? 'ho-abn' : ''}">${esc(String(r.v))}${r.u ? ' ' + esc(r.u) : ''}${f ? ' ' + esc(f) : ''}</td><td class="muted">${esc(U.fmtDate(time))}</td></tr>`; }).join('')}</table>` : '<p class="muted">No results.</p>';
    const allergies = p.nkda || !(p.allergies || []).length ? '<p>No Known Drug Allergies</p>' : p.allergies.map(a => `<p class="tk-red">${esc(a.agent)} <span class="muted">— ${esc(a.reaction)}</span></p>`).join('');
    const problems = [p.admitDx, ...(p.pmh || [])].map(x => `<p>${esc(x)}</p>`).join('');
    const w = (title, body) => `<section class="ho-w"><h3>▾ ${esc(title)}</h3>${body}</section>`;
    if (part === 'vl') return w('Vitals — Initial & Most Recent', vitals) + w('Lab Results Last Value', labs);
    return `<div class="ho-widgets"><div>${w('Vitals — Initial & Most Recent', vitals)}${w('Lab Results Last Value', labs)}</div>
      <div>${w('Contact Detail', `<p><strong>Emergency contact:</strong> ${esc(p.emergencyContact || '—')}</p><p><strong>Language:</strong> ${esc(Model.language(p))}${p.interpreter ? ' (interpreter needed)' : ''}</p>`)}${w('Allergies', allergies)}${w('Active Problems', problems)}</div></div>`;
  }

  function paneHead(p) {
    const initials = (p.name.first[0] + p.name.last[0]).toUpperCase();
    const allergy = p.nkda || !(p.allergies || []).length ? 'NKDA' : p.allergies.map(a => a.agent).join(', ');
    return `<div class="ho-head">
        <div class="avatar ho-avatar" aria-hidden="true">${esc(initials)}</div>
        <div><div class="ho-name">${esc(p.name.last)}, ${esc(p.name.first)}</div><div>${esc(String(p.age).replace(' years', ''))} ${esc(p.sex)} • ${esc(U.fmtDOB(p.dob))}</div><div>${esc(Model.location(p))}</div></div>
        <div><div><em>Code Status:</em> <span class="tk-red">${esc(p.codeStatus)}</span></div><div><em>Allergy/Adv:</em> ${esc(allergy)}</div></div>
        <div class="ho-right"><div><em>Admit Date:</em> ${esc(U.fmtDT(p.admitTime))}</div><div><em>Account #:</em> ${esc(Model.account(p))}</div><div><em>Attending:</em> ${esc(p.attending)}</div></div>
      </div>`;
  }

  // Patient summary half screen: the chart at a glance without opening it.
  function summaryPane(p) {
    const doc = Store.doc(p.id);
    const w = (title, body) => `<section class="ho-w"><h3>▾ ${esc(title)}</h3>${body}</section>`;
    const unacked = Model.unackedOrders(p, doc).map(o => o.id);
    const orders = [...p.orders].sort((a, b) => b.time - a.time).slice(0, 8)
      .map(o => `<tr><td>${esc(U.fmtDT(o.time))}</td><td>${esc(o.text)}${unacked.includes(o.id) ? ' ' + UI.badge('NEW', 'new') : ''}</td></tr>`).join('');
    const meds = p.meds.filter(m => m.status === 'Active').map(m => {
      const next = (m.doseTimes || []).map(dt => ({ dt, s: Model.doseStatus(p, doc, m, dt).code })).find(x => ['due', 'overdue', 'future'].includes(x.s));
      return `<tr><td><strong>${esc(m.name)}</strong> ${esc([m.dose, m.route].filter(x => x && x !== '—').join(' '))}<div class="muted small">${esc(m.freq)}</div></td>
        <td class="${next && next.s === 'overdue' ? 'tk-red' : ''}">${m.type === 'prn' ? 'PRN' : m.type === 'continuous' ? 'Infusing' : next ? (next.s === 'overdue' ? 'Overdue ' : next.s === 'due' ? 'Due ' : 'Next ') + esc(U.fmtTime(next.dt.time)) : '—'}</td></tr>`;
    }).join('');
    const tasks = Views.worklist.due(p, doc).slice(0, 6).map(x => `<tr><td class="${x.overdue ? 'tk-red' : ''}">${esc(U.fmtTime(x.time))}</td><td>${esc(x.text || x.name)}</td></tr>`).join('');
    const io = Model.io(p, doc);
    const inn = io.filter(r => r.kind === 'in').reduce((n, r) => n + (Number(r.amt) || 0), 0), out = io.filter(r => r.kind === 'out').reduce((n, r) => n + (Number(r.amt) || 0), 0);
    return `<section class="ho-pane" aria-label="Patient summary — ${esc(p.name.last)}, ${esc(p.name.first)}">
      ${paneHead(p)}
      <div class="ho-sum-bar"><strong>Patient Summary</strong> <span class="muted small">— ${esc(Model.chiefComplaint(p))} · ${esc(p.admitDx)}</span>
        <a class="tk-btn" href="#/patient/${esc(p.id)}/summary">Open Chart</a></div>
      <div class="ho-sum">
        <div>${hoWidgets(p, doc, 'vl')}</div>
        <div>${w('Current Medications', meds ? `<table class="ho-tbl">${meds}</table>` : '<p class="muted">No active medications.</p>')}
          ${w('Orders', orders ? `<table class="ho-tbl">${orders}</table>` : '<p class="muted">No orders.</p>')}</div>
        <div>${w('Due Next', tasks ? `<table class="ho-tbl">${tasks}</table>` : '<p class="muted">Nothing due.</p>')}
          ${w('Intake & Output (charted)', `<p>In: <strong>${inn} mL</strong> · Out: <strong>${out} mL</strong> · Balance: <strong>${inn - out >= 0 ? '+' : ''}${inn - out} mL</strong></p>`)}
          ${w('Allergies', p.nkda || !(p.allergies || []).length ? '<p>No Known Drug Allergies</p>' : p.allergies.map(a => `<p class="tk-red">${esc(a.agent)} <span class="muted">— ${esc(a.reaction)}</span></p>`).join(''))}
          ${w('Active Problems', [p.admitDx, ...(p.pmh || [])].map(x => `<p>${esc(x)}</p>`).join(''))}
          ${w('Contact Detail', `<p>${esc(p.emergencyContact || '—')}</p><p><strong>Language:</strong> ${esc(Model.language(p))}${p.interpreter ? ' (interpreter needed)' : ''}</p>`)}</div>
      </div>
    </section>`;
  }

  function handoffPane(p) {
    const doc = Store.doc(p.id);
    const list = handoffs(doc);
    const latest = list[0];
    const rev = latest && reviewOf(doc, latest.id);
    const editing = hoEdit && hoEdit.pid === p.id;
    return `<section class="ho-pane" aria-label="Hand off — ${esc(p.name.last)}, ${esc(p.name.first)}">
      ${paneHead(p)}
      <div class="ho-body">
        <div class="ho-note">
          <div class="ho-note-h"><strong>${latest ? `${esc(latest.user.name)}, ${esc(U.fmtDT(latest.time))}` : 'No handoff written yet'}</strong><button type="button" class="tk-btn" data-ho="history" ${list.length ? '' : 'disabled'}>History</button></div>
          <div class="ho-note-btns"><button type="button" class="tk-btn" data-ho="new">New</button><button type="button" class="tk-btn" data-ho="prev" ${latest ? '' : 'disabled'}>New from previous</button>
            <button type="button" class="tk-btn" data-ho="review" ${latest && !rev && !editing ? '' : 'disabled'}>Mark Reviewed</button></div>
          ${editing ? `<form class="ho-edit"><textarea name="text" rows="18" aria-label="Handoff note">${esc(hoEdit.text)}</textarea>
              <div class="form-actions"><button type="button" class="btn" data-ho="cancel">Cancel</button><button type="submit" class="btn btn-primary">Save Handoff</button></div></form>`
            : latest ? `<div class="ho-text">${U.nl2br(latest.data.text)}</div>${rev ? `<p class="muted small">✔ Reviewed by ${esc(rev.user.name)} ${esc(U.fmtDT(rev.time))}</p>` : ''}`
            : '<p class="muted">Select <strong>New</strong> to write a handoff. It starts from an SBAR draft built from the chart.</p>'}
        </div>
        ${hoWidgets(p, doc)}
      </div>
    </section>`;
  }

  function bindHandoff(root, p) {
    const ho = (k, fn) => root.querySelectorAll(`[data-ho="${k}"]`).forEach(b => b.addEventListener('click', e => { e.preventDefault(); fn(); }));
    const doc = Store.doc(p.id);
    ho('new', () => { hoEdit = { pid: p.id, text: sbarDraft(p, doc) }; App.render(); });
    ho('prev', () => { const l = handoffs(doc)[0]; hoEdit = { pid: p.id, text: l ? l.data.text : sbarDraft(p, doc) }; App.render(); });
    ho('cancel', () => { hoEdit = null; App.render(); });
    ho('review', () => { const l = handoffs(doc)[0]; if (l && Store.add(p.id, 'ack', { ref: l.id, kind: 'handoff' }, Date.now(), Date.now())) UI.toast('Handoff marked reviewed.'); App.render(); });
    ho('history', () => UI.modal({ title: `Handoff History — ${p.name.last}, ${p.name.first}`, wide: true,
      body: handoffs(Store.doc(p.id)).map(e => `<article class="note"><header><strong>${esc(U.fmtDT(e.time))}</strong> · ${esc(e.user.name)}</header><div>${U.nl2br(e.data.text)}</div></article>`).join(''),
      buttons: [{ label: 'Close' }] }));
    const f = root.querySelector('.ho-edit');
    if (f) f.addEventListener('submit', e => {
      e.preventDefault();
      const text = f.text.value.trim();
      if (!text) { UI.formError(f, 'Write the handoff before saving.'); return; }
      if (Store.add(p.id, 'notes', { type: HO_TYPE, text }, Date.now(), Date.now())) { hoEdit = null; UI.toast('Handoff saved.'); }
      App.render();
    });
  }

  Screens.census = {
    selected: () => selected,
    render() {
      const s = Store.session();
      const all = Model.allPatients();
      const mine = Store.myList().filter(id => all.some(b => b.id === id));
      const faculty = Screens.mode() === 'faculty';
      if (listTab == null || !faculty) listTab = 'my';
      const shown = all.filter(b => inList(listTab, b));
      if (selected && !shown.some(b => b.id === selected)) selected = null;
      const paneOn = selected ? pane : null;
      const tab = (t, label, n) => `<button type="button" class="tk-tab ${listTab === t ? 'on' : ''}" data-list="${esc(t)}">${t !== 'my' ? '▾ ' : ''}${esc(label)} <span class="tk-n">${n}</span></button>`;
      return `<div class="tk">
        <div class="tk-top">
          <div class="tk-burger-wrap"><button type="button" class="tk-burger" data-action="burger" aria-haspopup="true" aria-expanded="false" title="List menu" aria-label="List menu">☰</button>
            <div class="tb-menu tk-burger-menu" hidden role="menu">
              <a href="#" role="menuitem" data-action="add">Add Patients…</a>
              <a href="#" role="menuitem" data-action="remove" class="${selected && listTab === 'my' ? '' : 'tk-off'}">Remove Selected Patient</a>
              <a href="#" role="menuitem" data-action="clear" class="${mine.length ? '' : 'tk-off'}">Clear My List</a>
              <a href="#" role="menuitem" data-action="refresh">Refresh</a>
              ${faculty ? `<div class="ml-menu-h">Faculty</div><a href="#" role="menuitem" data-list="${listTab === 'all' ? 'my' : 'all'}">${listTab === 'all' ? 'Back to My List' : `All Test Accounts (${all.length})`}</a>` : ''}
            </div></div>
          <h1 class="tk-user">${esc(s.name)}</h1>
          <div class="tk-find">
            <button type="button" class="tk-refresh" data-action="refresh" title="Refresh" aria-label="Refresh">↻</button>
            <form class="tk-search" data-action="find"><input name="find" placeholder="Find Patient" autocomplete="off" aria-label="Find Patient"><button type="submit" aria-label="Search">🔍</button></form>
          </div>
        </div>
        <div class="tk-tabs">
          ${tab('my', 'My List', mine.length)}
          ${listTab === 'all' ? tab('all', 'All Test Accounts', all.length) : ''}
          <div class="tk-actions">
            ${paneOn ? `<button type="button" class="tk-btn tk-btn-on" data-action="closepane">Close ${paneOn === 'handoff' ? 'Handoff' : 'Summary'}</button>` : ''}
            ${paneOn === 'summary' ? '' : `<button type="button" class="tk-btn" data-action="summary" ${selected ? '' : 'disabled'}>Open Patient Summary</button>`}
            ${paneOn === 'handoff' ? '' : `<button type="button" class="tk-btn" data-action="handoff" ${selected ? '' : 'disabled'}>Open Hand Off</button>`}
            ${listTab === 'my' ? '' : `<button type="button" class="tk-btn" data-action="addsel" ${selected && !mine.includes(selected) ? '' : 'disabled'}>Add to My List</button>`}
          </div>
        </div>
        ${paneOn ? `<div class="ho">
          <div class="ho-list">${shown.map(b => { const ip = (b.name.first[0] + b.name.last[0]).toUpperCase(); return `<div class="ho-row ${b.id === selected ? 'ho-sel' : ''}" data-hopick="${esc(b.id)}" tabindex="0">
              <div class="avatar ho-mini" aria-hidden="true">${esc(ip)}</div><div><strong>${esc(b.name.last)}, ${esc(b.name.first)}</strong><div class="tk-cc"><strong>${esc(Model.chiefComplaint(b))}</strong></div><div class="muted">${esc(String(b.age).replace(' years', ''))} ${esc(b.sex)} · ${esc(b.room || '')}</div></div></div>`; }).join('')}</div>
          ${paneOn === 'handoff' ? handoffPane(Model.get(selected)) : summaryPane(Model.get(selected))}
        </div>` : `<div class="tk-head"><span></span><span></span><span>Name<br>Age/Sex<br>Unit · Room</span><span>Reason for Visit<br>Attending<br>Admitted</span><span>Alerts<br>Home Meds</span><span>Code Status<br>Allergies<br>Isolation</span><span></span><span>Vital Signs<br>Orders/Results</span></div>
        <div class="tk-list">${shown.length ? shown.map(row).join('')
          : listTab === 'my' ? `<div class="empty tk-empty">No patients on your list. Select the <strong>☰</strong> menu next to your name, then <strong>Add Patients…</strong></div>`
          : '<div class="empty tk-empty">No test accounts on this list.</div>'}</div>`}
        <p class="muted small tk-tip">Select a patient, then use Chart, Document, or Orders above, or double-click to open the chart. ▸ shows more. Always verify two identifiers.</p>
      </div>`;
    },
    bind(root) {
      const go = (id, tab) => { if (id) location.hash = `#/patient/${id}/${tab || 'summary'}`; };
      const act = (name, fn) => root.querySelectorAll(`[data-action="${name}"]`).forEach(b => b.addEventListener('click', e => { e.preventDefault(); fn(b); }));
      const burger = root.querySelector('[data-action="burger"]'), bmenu = root.querySelector('.tk-burger-menu');
      burger.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        bmenu.hidden = !bmenu.hidden; burger.setAttribute('aria-expanded', String(!bmenu.hidden));
        if (!bmenu.hidden) setTimeout(() => document.addEventListener('click', () => { bmenu.hidden = true; burger.setAttribute('aria-expanded', 'false'); }, { once: true }), 0);
      });
      act('add', () => addPatients());
      act('clear', () => { if (!Store.myList().length) return; UI.confirm('Clear My List', 'Remove every patient from your list? Their charts are not changed.', () => { Store.setMyList([]); selected = null; App.render(); }, 'Clear'); });
      act('refresh', () => App.render());
      act('summary', () => { if (selected) { pane = 'summary'; hoEdit = null; App.render(); } });
      act('handoff', () => { if (selected) { pane = 'handoff'; hoEdit = null; App.render(); } });
      act('closepane', () => { pane = null; hoEdit = null; App.render(); });
      root.querySelectorAll('[data-hopick]').forEach(r => {
        r.addEventListener('click', () => { if (r.dataset.hopick !== selected) { selected = r.dataset.hopick; hoEdit = null; App.render(); } });
        r.addEventListener('dblclick', () => go(r.dataset.hopick));
        r.addEventListener('keydown', e => { if (e.key === 'Enter') { selected = r.dataset.hopick; hoEdit = null; App.render(); } });
      });
      if (pane === 'handoff' && selected && root.querySelector('.ho-note')) bindHandoff(root, Model.get(selected));
      act('remove', () => {
        if (!selected || listTab !== 'my') { UI.toast('Select a patient on your list first.', 'warn'); return; }
        Store.setMyList(Store.myList().filter(x => x !== selected)); selected = null; App.render();
      });
      act('addsel', () => { Store.setMyList(Store.myList().concat(selected)); UI.toast('Added to My List.'); App.render(); });
      root.querySelectorAll('[data-list]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); listTab = b.dataset.list; selected = null; App.render(); }));
      root.querySelector('[data-action="find"]').addEventListener('submit', e => { e.preventDefault(); findPatient(e.target.find.value); });
      root.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); expanded[b.dataset.exp] = !expanded[b.dataset.exp]; App.render(); }));
      root.querySelectorAll('[data-open]').forEach(r => {
        r.addEventListener('click', e => {
          if (e.target.closest('a, button')) return;
          selected = r.dataset.open;
          App.render();
        });
        r.addEventListener('dblclick', e => { if (!e.target.closest('a, button')) go(r.dataset.open); });
        r.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === r) go(r.dataset.open); });
      });
    }
  };

  /* ---------------- Instructor tools ---------------- */
  Screens.unlock = function (then) {
    if (Store.instructorUnlocked()) { then(); return; }
    UI.modal({
      title: 'Instructor Tools',
      body: '<label class="field"><span>Instructor PIN</span><input type="password" name="pin" autofocus inputmode="numeric"></label>',
      buttons: [{ label: 'Cancel' }, { label: 'Unlock', cls: 'btn-primary', onClick: api => {
        if (U.formValues(api.el).pin !== String(C.instructorPin)) { UI.formError(api.el.querySelector('.modal-body'), 'Incorrect PIN.'); return false; }
        Store.setInstructor(true);
        then();
      } }]
    });
  };

  Screens.instructor = {
    render() {
      const pts = Model.allPatients();
      const cards = pts.map(base => {
        const p = Model.get(base.id);
        const doc = Store.doc(p.id);
        const rel = Store.released(p.id);
        const count = Store.SECTIONS.reduce((n, s) => n + doc[s].length, 0);
        const custom = Store.customPatients().some(c => c.id === p.id);
        return `<section class="panel">
          <header class="panel-head"><h2>${esc(p.name.last)}, ${esc(p.name.first)} <span class="muted">— ${esc(p.admitDx)} · ${esc(Model.location(p))}</span></h2>
            <div class="panel-actions">
              <a class="btn btn-sm" href="#/patient/${esc(p.id)}/summary">Open Chart</a>
              <a class="btn btn-sm" href="#/patient/${esc(p.id)}/report">Chart Report</a>
              <button class="btn btn-sm" data-restart="${esc(p.id)}">Restart Clock</button>
              <button class="btn btn-sm btn-danger" data-reset="${esc(p.id)}">Reset Patient</button>
              ${custom ? `<button class="btn btn-sm btn-danger" data-delcustom="${esc(p.id)}">Remove Patient</button>` : ''}
            </div></header>
          <div class="panel-body">
            <p>Chart clock: <strong>${U.fmtDT(p.clock.now())}</strong> (real time; scenario written for ${esc(p.scenarioStart || "—")}, shifted ${p.clock.shift / 3600000 >= 0 ? "+" : ""}${Math.round(p.clock.shift / 3600000)} h) · ${count} student entr${count === 1 ? 'y' : 'ies'} · MRN barcode <code>${esc(p.mrn)}</code></p>
            ${p.labsPending ? `<p class="warn-box">${esc(p.labsPending)}</p>` : ''}
            ${(base.events || []).length ? `<h3>Scenario events</h3>${base.events.map(ev => `<div class="event ${rel[ev.id] ? 'event-on' : ''}">
                <div><strong>${esc(ev.title)}</strong>
                  <div class="muted small">${[(ev.orders || []).length && (ev.orders.length + ' order(s)'), (ev.meds || []).length && (ev.meds.length + ' med(s)'), (ev.labs || []).length && (ev.labs.length + ' result panel(s)')].filter(Boolean).join(' · ')}</div>
                  ${ev.instructorNotes ? `<details><summary>Instructor notes</summary><p>${esc(ev.instructorNotes)}</p></details>` : ''}</div>
                <div>${rel[ev.id] ? `<span class="badge badge-ok">Released ${U.fmtTime(p.clock.toSim(rel[ev.id]))}</span> <button class="btn btn-sm" data-unrelease="${esc(p.id)}|${esc(ev.id)}">Undo</button>`
                  : `<button class="btn btn-sm btn-primary" data-release="${esc(p.id)}|${esc(ev.id)}">Release Now</button>`}</div>
              </div>`).join('')}` : '<p class="muted">No scripted events for this patient.</p>'}
            ${(base.facultyGuide || []).map(g => `<details class="faculty-guide"><summary>📘 ${esc(g.title)} (instructor only)</summary><div class="note-body">${U.md(g.md)}</div></details>`).join('')}
          </div></section>`;
      }).join('');

      return `<div class="page">
        <div class="page-head"><h1>Instructor Tools</h1><div>
          <a class="btn" href="labels.html" target="_blank" rel="noopener">Print Wristbands & Med Labels</a>
          <button class="btn" data-action="export">Export All Documentation</button>
          <label class="btn">Import Documentation<input type="file" accept=".json,application/json" data-action="import" hidden></label>
          <label class="btn">Add Patient (JSON)<input type="file" accept=".json,application/json" data-action="addpt" hidden></label>
          <button class="btn" data-action="lock">Lock</button>
        </div></div>
        <div class="alert alert-info">Documentation is saved in <strong>this browser only</strong>. Release events and export charting on the same workstation the student used. "Reset Patient" erases that patient's documentation and restarts the scenario.</div>
        ${cards}
      </div>`;
    },
    bind(root) {
      const pts = () => Model.allPatients().map(p => p.id);
      root.querySelectorAll('[data-release]').forEach(b => b.addEventListener('click', () => { const [pid, ev] = b.dataset.release.split('|'); Store.release(pid, ev); UI.toast('Event released to the chart.'); App.render(); }));
      root.querySelectorAll('[data-unrelease]').forEach(b => b.addEventListener('click', () => { const [pid, ev] = b.dataset.unrelease.split('|'); Store.unrelease(pid, ev); App.render(); }));
      root.querySelectorAll('[data-restart]').forEach(b => b.addEventListener('click', () => UI.confirm('Restart clock', 'Set this chart\'s clock back to the scenario start time? Existing documentation keeps its times.', () => { Store.restartScenario(b.dataset.restart); App.render(); }, 'Restart')));
      root.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => UI.confirm('Reset patient', 'Erase ALL student documentation and released events for this patient? This cannot be undone. Export first if you need a copy.', () => { Store.resetPatient(b.dataset.reset); UI.toast('Patient reset.', 'warn'); App.render(); }, 'Erase & Reset')));
      root.querySelectorAll('[data-delcustom]').forEach(b => b.addEventListener('click', () => UI.confirm('Remove patient', 'Remove this imported patient from this browser?', () => { Store.deleteCustomPatient(b.dataset.delcustom); Store.resetPatient(b.dataset.delcustom); App.render(); }, 'Remove')));
      root.querySelector('[data-action="export"]').addEventListener('click', () =>
        U.download(`SimEHR_export_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify(Store.exportAll(pts()), null, 2)));
      root.querySelector('[data-action="lock"]').addEventListener('click', () => { const sess = Store.session(); delete sess.viewExperience; Store.setSession(sess); Store.setInstructor(false); location.hash = '#/census'; });
      const readFile = (input, fn) => input.addEventListener('change', () => {
        const f = input.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => { try { fn(JSON.parse(r.result)); App.render(); } catch (err) { UI.toast(err.message, 'danger'); } input.value = ''; };
        r.readAsText(f);
      });
      readFile(root.querySelector('[data-action="import"]'), obj => { Store.importAll(obj); UI.toast('Documentation imported.'); });
      readFile(root.querySelector('[data-action="addpt"]'), obj => {
        const list = Array.isArray(obj) ? obj : [obj];
        list.forEach(pt => {
          if (!pt.id || !pt.name || !pt.mrn || !pt.dob) throw new Error('Patient JSON needs at least id, name, mrn, and dob.');
          if ((window.SIM_PATIENTS || []).some(x => x.id === pt.id)) throw new Error(`A built-in patient already uses id "${pt.id}".`);
          Store.saveCustomPatient(pt);
        });
        UI.toast(`${list.length} patient(s) added to this browser.`);
      });
    }
  };
})();
