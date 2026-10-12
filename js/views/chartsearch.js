/*
 * Search Patient's Chart (right-hand column of the chart). Cross-references every part of the
 * chart: problems and history, allergies, orders, medications, results, imaging, provider and
 * nursing notes, documents, vital signs, administrative data, and everything the student has
 * documented. Each match links to the chart screen where it lives.
 */
(function () {
  'use strict';
  const esc = U.esc;
  const SKIP = { id: 1, images: 1, image: 1, files: 1, at: 1, day: 1, md: 0 };

  // All text inside a value (strings and numbers, nested arrays and objects).
  function flat(v) {
    if (v == null || v === false) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (Array.isArray(v)) return v.map(flat).filter(Boolean).join(' · ');
    if (typeof v === 'object') return Object.keys(v).filter(k => !SKIP[k]).map(k => flat(v[k])).filter(Boolean).join(' · ');
    return '';
  }

  function index(p, doc) {
    const out = [];
    // Markdown marks (**bold**, # headings, > callouts) are dropped so snippets read as plain text.
    const plain = x => flat(x).replace(/\*\*|__|^#+\s*|^>\s*/gm, '').replace(/\s+/g, ' ').trim();
    const add = (section, tab, title, time, text) => { const t = plain(text); if (t || title) out.push({ section, tab, title: plain(title), time, text: t }); };

    add('Problems', 'history', 'Reason for visit', p.admitTime, [p.admitDx, p.chiefComplaint]);
    (p.pmh || []).forEach(x => add('Problems', 'history', 'Medical history', null, x));
    (p.psh || []).forEach(x => add('History', 'history', 'Surgical history', null, x));
    (p.familyHx || []).forEach(x => add('History', 'history', 'Family history', null, x));
    (p.socialHx || []).forEach(x => add('History', 'history', 'Social history', null, x));
    if (p.hpi) add('History', 'history', 'History of present illness', null, p.hpi);
    if (p.nkda || !(p.allergies || []).length) add('Allergies', 'summary', 'No Known Drug Allergies', null, 'NKDA no known allergies');
    (p.allergies || []).forEach(a => add('Allergies', 'summary', a.agent, null, a));
    (p.flags || []).forEach(f => add('Special Indicators', 'summary', f, null, ''));
    add('Special Indicators', 'summary', 'Code status: ' + p.codeStatus, null, [p.advanceDirective, p.isolation ? 'Isolation: ' + p.isolation : '']);
    (p.homeMeds || []).forEach(m => add('Home Medications', 'meds', m.name, null, m));
    p.orders.forEach(o => add('Orders', 'orders', o.text, o.time, [o.cat, o.priority, o.by, o.detail, o.instructions]));
    p.meds.forEach(m => add('Medications', 'mar', Model.medLabel(m), m.orderTime, [m.status, m.indication, m.instructions, m.holdReason, m.orderedBy]));
    p.labs.forEach(l => add('Lab Results', 'results', l.panel, l.time, (l.results || []).map(r => `${r.t} ${r.v}${r.u ? ' ' + r.u : ''}${Model.labFlag(r) ? ' ' + Model.labFlag(r) : ''}`)));
    if (p.labsPending) add('Lab Results', 'results', 'Pending', null, p.labsPending);
    p.imaging.forEach(r => add('Imaging', 'results', r.study, r.time, [r.text, r.findings, r.impression, r.report]));
    p.notes.forEach(n => add(Views.isProviderNote(n) ? 'Provider Notes' : 'Nursing Notes', Views.isProviderNote(n) ? 'provnotes' : 'notes', `${n.type || 'Note'} — ${n.author || ''}`, n.time, n.text));
    (p.documents || []).forEach(d => add('Documents', 'documents', d.title, d.time, [d.category, d.md, d.text]));
    (p.vitalsPrior || []).forEach(v => add('Vital Signs', 'vitals', 'Vital signs', v.time, vitalText(v)));
    add('Administrative', 'admin', 'Patient information', null, [p.mrn, Model.account(p), p.unit, p.room, p.attending, p.service, p.emergencyContact, p.demographics, p.insurance]);

    // The student's own documentation.
    const active = sec => (doc[sec] || []).filter(e => e.status === 'active');
    active('notes').forEach(e => add('Nursing Notes', 'notes', `${e.data.type || 'Note'} — ${e.user.name}`, e.time, e.data));
    active('assess').forEach(e => add('Assessments', 'assess', `${e.data.form || e.data.title || 'Assessment'} — ${e.user.name}`, e.time, e.data));
    active('vitals').forEach(e => add('Vital Signs', 'vitals', `Vital signs — ${e.user.name}`, e.time, vitalText(e.data)));
    active('mar').forEach(e => add('Medication Administration', 'mar', `${e.data.medName} — ${e.data.action}`, e.time, [e.data.dose, e.data.rate, e.data.route, e.data.site, e.data.reason, e.data.comment, e.user.name]));
    active('io').forEach(e => add('Intake & Output', 'io', 'Intake & output', e.time, e.data));
    active('careplan').forEach(e => add('Plan of Care', 'careplan', 'Plan of care', e.time, e.data));
    active('tar').forEach(e => add('Transfusion', 'tar', 'Transfusion record', e.time, e.data));
    return out;
  }

  function vitalText(v) {
    return [v.temp != null && `Temp ${v.temp}`, v.hr != null && `Pulse ${v.hr}`, v.rr != null && `Resp ${v.rr}`,
      v.sbp != null && `BP ${v.sbp}/${v.dbp}`, v.spo2 != null && `O2 Sat ${v.spo2}%`, v.o2 && `${v.o2}${v.o2Flow ? ' ' + v.o2Flow + ' L' : ''}`,
      v.pain != null && `Pain ${v.pain}`, v.by].filter(Boolean).join(' · ');
  }

  // Escaped snippet around the first match, with every search word highlighted.
  function snippet(text, words) {
    const low = text.toLowerCase();
    const at = Math.max(0, Math.min(...words.map(w => { const i = low.indexOf(w); return i < 0 ? Infinity : i; })));
    const start = Math.max(0, (isFinite(at) ? at : 0) - 60);
    let s = (start ? '…' : '') + text.slice(start, start + 220) + (text.length > start + 220 ? '…' : '');
    s = esc(s);
    words.forEach(w => { const re = new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); s = s.replace(re, m => `<mark>${m}</mark>`); });
    return s;
  }

  // Common clinical abbreviations, so "hemoglobin" also finds "Hgb" and "bp" finds "blood pressure".
  const SYN = [['hemoglobin', 'hgb'], ['hematocrit', 'hct'], ['potassium', 'k'], ['sodium', 'na'], ['chloride', 'cl'], ['magnesium', 'mg'],
    ['white blood', 'wbc'], ['platelet', 'plt'], ['blood urea', 'bun'], ['creatinine', 'creat'], ['glucose', 'bg'], ['troponin', 'trop'],
    ['blood pressure', 'bp'], ['pulse', 'hr'], ['heart rate', 'hr'], ['respirat', 'rr'], ['temperature', 'temp'], ['oxygen', 'o2'], ['saturation', 'spo2'],
    ['norepinephrine', 'levophed'], ['acetaminophen', 'tylenol'], ['piperacillin', 'zosyn'], ['enoxaparin', 'lovenox'], ['heparin', 'hep'],
    ['nothing by mouth', 'npo'], ['do not resuscitate', 'dnr'], ['history', 'hx'], ['diagnosis', 'dx']];
  const alts = w => { const out = [w]; SYN.forEach(([a, b]) => { if (w === a || a.startsWith(w) && w.length > 3) out.push(b); if (w === b) out.push(a); }); return out; };
  // Whole-word test for very short terms (k, na, hr) so they don't match inside other words.
  const has = (hay, t) => t.length <= 3 ? new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(hay) : hay.includes(t);

  function open(p, query) {
    const q = String(query || '').trim();
    if (!q) return;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const doc = Store.doc(p.id);
    const hits = index(p, doc).filter(e => { const hay = (e.title + ' ' + e.text).toLowerCase(); return words.every(w => alts(w).some(t => has(hay, t))); });
    // Highlight the search words and their abbreviations (skipping one- and two-letter ones).
    const hl = Array.from(new Set(words.flatMap(alts))).filter(t => t.length > 2 || words.includes(t));
    const groups = {};
    hits.forEach(h => { (groups[h.section] = groups[h.section] || []).push(h); });
    UI.modal({
      title: `Search Patient's Chart — “${q}”`,
      wide: true,
      body: `<p class="muted small">${esc(p.name.last)}, ${esc(p.name.first)} · MRN ${esc(p.mrn)} — ${hits.length} match${hits.length === 1 ? '' : 'es'}. Select a result to open it.</p>
        ${hits.length ? Object.keys(groups).map(sec => `<section class="cs-group"><h3>${esc(sec)} <span class="muted">(${groups[sec].length})</span></h3>
          ${groups[sec].map(h => `<a class="cs-hit" href="#/patient/${esc(p.id)}/${esc(h.tab)}" data-go><div class="cs-title">${snippet(h.title, hl)}${h.time ? ` <span class="muted">${esc(U.fmtDT(h.time))}</span>` : ''}</div>
            ${h.text ? `<div class="cs-text">${snippet(h.text, hl)}</div>` : ''}</a>`).join('')}</section>`).join('')
          : '<p class="empty">Nothing in this chart matches. Try fewer or different words (for example a drug name, lab test, or diagnosis).</p>'}`,
      onOpen(api) { api.el.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', () => api.close())); },
      buttons: [{ label: 'Close' }]
    });
  }

  Views.chartSearch = { index, open };
})();
