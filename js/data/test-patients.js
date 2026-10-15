/*
 * EMR Training Environment — bank of TEST patient accounts.
 * Fictional patients for clinical onboarding practice. They are NOT the ATU simulation
 * patients and do not follow any simulation scenario. Every account is available to every
 * user; students add them to My List from the ☰ menu on the status board.
 *
 * Each account is built by pt() below from a short description, so adding one is easy:
 * copy an entry, change the id, MRN, name, and clinical details. Times work as in the
 * simulation EHR (time/day, or "at" = minutes before the chart's start time); scheduled
 * medications follow the standard MAR times, and doses due before the chart opens are
 * already documented by the prior shift ("RN").
 */
(function () {
  'use strict';

  /* ---------- Small builders for common results ---------- */
  const cbc = (id, time, wbc, hgb, hct, plt, day) => ({ id, panel: 'Complete Blood Count', time, day, results: [
    { t: 'WBC', v: wbc, u: 'x10³/µL', lo: 4.5, hi: 11 }, { t: 'Hgb', v: String(hgb), u: 'g/dL', lo: 12, hi: 17 },
    { t: 'HCT', v: hct, u: '%', lo: 36, hi: 50 }, { t: 'Platelets', v: plt, u: 'x10³/µL', lo: 150, hi: 400 }] });
  const bmp = (id, time, na, k, cl, co2, bun, cr, glu, day) => ({ id, panel: 'Basic Metabolic Panel', time, day, results: [
    { t: 'Sodium', v: na, u: 'mEq/L', lo: 135, hi: 145 }, { t: 'Potassium', v: String(k), u: 'mEq/L', lo: 3.5, hi: 5.1 },
    { t: 'Chloride', v: cl, u: 'mEq/L', lo: 98, hi: 107 }, { t: 'CO2', v: co2, u: 'mEq/L', lo: 22, hi: 29 },
    { t: 'BUN', v: bun, u: 'mg/dL', lo: 7, hi: 20 }, { t: 'Creatinine', v: String(cr), u: 'mg/dL', lo: 0.6, hi: 1.2 },
    { t: 'Glucose', v: glu, u: 'mg/dL', lo: 70, hi: 110 }] });
  const vs = (time, temp, hr, rr, sbp, dbp, spo2, o2, pain, day, extra) => Object.assign({ time, day, temp, tempRoute: 'Oral', hr, rr, sbp, dbp, spo2, o2: o2 || 'Room air', pain, by: 'Prior shift RN' }, extra || {});

  /* ---------- One test account from a short description ---------- */
  function pt(o) {
    const adm = o.admitted || { time: '18:00', day: -1 };
    const by = o.attending;
    const base = [
      { cat: 'Admission', text: o.admitOrder || `Admit to ${o.unit}` },
      { cat: 'Code Status', text: o.codeStatus || 'Full Code' },
      { cat: 'Nursing', text: o.vitalsOrder || 'Vital signs every 4 hours' },
      { cat: 'Diet', text: o.diet || 'Regular diet' },
      { cat: 'Activity', text: o.activity || 'Up as tolerated' }
    ];
    const orders = base.concat(o.orders || []).map((x, i) => Object.assign({ id: `${o.id}-o${i + 1}`, by }, adm, x));
    const meds = (o.meds || []).map(m => Object.assign({ ordered: adm }, m, { id: `${o.id}-${m.id}` }));
    const allergies = o.allergies || [];
    return Object.assign({
      level: 3,
      experiences: ['test'],
      service: 'Medicine',
      admitted: adm,
      scenarioStart: '08:00',
      priorDosesGiven: true,
      isolation: 'Standard',
      advanceDirective: 'None on file',
      nkda: !allergies.length,
      assessmentForms: ['wdl-adult', 'pain', 'morse', 'braden'],
      emergencyContact: 'Family member — phone on file',
      demographics: { 'Primary language': 'English', Insurance: 'Commercial' },
      pmh: [], psh: [], familyHx: [], socialHx: [], homeMeds: [],
      imaging: [], io: [], events: [], labs: [], vitals: []
    }, o, {
      allergies,
      codeStatus: o.codeStatus || 'Full Code',
      flags: o.flags || [],
      orders,
      meds,
      notes: [{ id: `${o.id}-hp`, type: o.noteType || 'History & Physical', author: by, ...adm, md: true,
        text: `**Chief complaint:** ${o.chiefComplaint}\n\n**HPI:** ${o.hpi}\n\n**PMH:** ${(o.pmh || []).join(', ') || 'None'}. **Allergies:** ${allergies.length ? allergies.map(a => `${a.agent} (${a.reaction})`).join(', ') : 'NKDA'}.\n\n**Assessment:** ${o.admitDx}\n\n**Plan:**\n${(o.plan || []).map((x, i) => `${i + 1}. ${x}`).join('\n')}` }].concat(o.notes || [])
    });
  }

  window.SIM_PATIENTS = [
    /* ---------------- Emergency Department ---------------- */
    pt({
      id: 'tst-martinez', name: { first: 'Elena', last: 'Martinez' }, mrn: 'TE100101', dob: '1981-02-11', age: '45 years', sex: 'F',
      unit: 'Emergency Department', room: 'ED Bay 3', attending: 'Dr. Priya Shah', service: 'Emergency Medicine',
      admitted: { at: -120 }, admitOrder: 'Place in observation — chest pain evaluation', diet: 'NPO except medications', activity: 'Bed rest',
      vitalsOrder: 'Vital signs every 1 hour', admitDx: 'Chest pain — rule out acute coronary syndrome', chiefComplaint: 'Chest pressure',
      allergies: [{ agent: 'Codeine', reaction: 'Nausea and vomiting', severity: 'Mild', tags: ['opioid'] }],
      heightCm: 163, weightKg: 70, flags: ['Continuous ECG'],
      hpi: 'Substernal chest pressure for 2 hours, radiating to the left arm, with diaphoresis. Pain 6/10 on arrival.',
      pmh: ['Hypertension', 'Hyperlipidemia'], socialHx: ['Smoker, 1 pack per day'],
      homeMeds: [{ name: 'Amlodipine', dose: '5 mg', route: 'PO', freq: 'Daily' }],
      plan: ['Serial troponins and ECGs', 'Aspirin now; nitroglycerin PRN chest pain', 'Cardiology consult if troponin rises'],
      orders: [{ cat: 'Lab', text: 'Troponin I now and every 3 hours x 2', priority: 'STAT' }, { cat: 'Diagnostics', text: '12-lead ECG now and with chest pain', priority: 'STAT' },
        { cat: 'Imaging', text: 'Portable chest X-ray' }, { cat: 'Consult', text: 'Consult cardiology', at: -10, isNew: true }],
      meds: [
        { id: 'asa', name: 'Aspirin (chewable)', dose: '324 mg', route: 'PO', freq: 'Once', type: 'once', doses: [{ at: -100, given: 'RN' }] },
        { id: 'ntg', name: 'Nitroglycerin', dose: '0.4 mg', route: 'SL', freq: 'Every 5 minutes PRN chest pain, max 3 doses', type: 'prn', indication: 'Chest pain', preAssess: ['SBP', 'Pain'], holdIf: [{ p: 'SBP', op: '<', v: 90 }] },
        { id: 'ns', name: '0.9% Sodium chloride', dose: '75 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', rate: '75 mL/hr' }],
      vitals: [vs('06:10', 98.4, 96, 20, 158, 94, 97, 'Room air', 6), vs('07:10', 98.2, 88, 18, 146, 88, 98, 'Room air', 3)],
      labs: [{ id: 'tst-martinez-trop1', panel: 'Cardiac Markers', time: '06:15', results: [{ t: 'Troponin I', v: '0.02', u: 'ng/mL', ref: '≤ 0.04' }] },
        cbc('tst-martinez-cbc', '06:15', 8.1, 13.2, 39, 245), bmp('tst-martinez-bmp', '06:15', 139, 4.1, 103, 25, 14, 0.8, 104)]
    }),
    pt({
      id: 'tst-okafor', name: { first: 'James', last: 'Okafor' }, mrn: 'TE100102', dob: '1997-07-30', age: '29 years', sex: 'M',
      unit: 'Emergency Department', room: 'ED Bay 7', attending: 'Dr. Priya Shah', service: 'Emergency Medicine',
      admitted: { at: -90 }, admitOrder: 'ED treatment — asthma exacerbation', vitalsOrder: 'Vital signs every 2 hours', admitDx: 'Asthma exacerbation', chiefComplaint: 'Shortness of breath',
      heightCm: 180, weightKg: 82, assessmentForms: ['wdl-adult', 'pain', 'morse'],
      hpi: 'Wheezing and shortness of breath for 1 day after a cold. Used his rescue inhaler 6 times today without relief.',
      pmh: ['Asthma since childhood'], homeMeds: [{ name: 'Albuterol inhaler', dose: '2 puffs', route: 'Inhaled', freq: 'Every 4 hours PRN' }],
      plan: ['Albuterol nebulizer every 4 hours and PRN', 'Prednisone 40 mg daily', 'Discharge if peak flow improves'],
      orders: [{ cat: 'Respiratory', text: 'Peak flow before and after each nebulizer' }, { cat: 'Respiratory', text: 'Oxygen to keep SpO2 ≥ 92%' }],
      meds: [
        { id: 'alb', name: 'Albuterol 2.5 mg in 3 mL NS', dose: '2.5 mg', route: 'Nebulizer', freq: 'Every 4 hours', type: 'scheduled', preAssess: ['HR', 'RR', 'SpO2'] },
        { id: 'pred', name: 'Prednisone', dose: '40 mg', route: 'PO', freq: 'Daily', type: 'scheduled' },
        { id: 'albprn', name: 'Albuterol 2.5 mg in 3 mL NS', dose: '2.5 mg', route: 'Nebulizer', freq: 'Every 1 hour PRN wheezing', type: 'prn', indication: 'Wheezing or shortness of breath', minIntervalHr: 1 }],
      vitals: [vs('06:40', 99.0, 112, 26, 138, 84, 91, 'Room air', 0), vs('07:30', 98.8, 104, 22, 132, 80, 94, 'Nasal cannula', 0, null, { o2Flow: 2 })]
    }),

    /* ---------------- Intensive Care ---------------- */
    pt({
      id: 'tst-whitaker', name: { first: 'Gerald', last: 'Whitaker' }, mrn: 'TE100103', dob: '1958-11-05', age: '67 years', sex: 'M',
      unit: 'Intensive Care Unit', room: 'ICU-02', attending: 'Dr. Mei Chen', service: 'Critical Care',
      vitalsOrder: 'Vital signs every 1 hour', diet: 'NPO', activity: 'Bed rest', admitDx: 'Sepsis from community-acquired pneumonia', chiefComplaint: 'Fever and confusion',
      heightCm: 178, weightKg: 88, flags: ['Central line', 'Continuous ECG'], assessmentForms: ['wdl-adult', 'pain', 'gcs', 'braden', 'morse'],
      hpi: 'Three days of cough and fever; brought in confused and hypotensive. Lactate 3.8 on arrival. Improved after 30 mL/kg fluid bolus.',
      pmh: ['Type 2 diabetes', 'Hypertension'], homeMeds: [{ name: 'Metformin', dose: '1000 mg', route: 'PO', freq: 'BID' }],
      plan: ['Cefepime and vancomycin', 'Norepinephrine to keep MAP ≥ 65', 'Repeat lactate', 'Insulin per sliding scale'],
      orders: [{ cat: 'Lab', text: 'Lactate every 4 hours until < 2' }, { cat: 'Lab', text: 'Blood cultures x 2 (drawn in ED)' }, { cat: 'Nursing', text: 'I & O every 1 hour; Foley catheter to gravity' },
        { cat: 'Nursing', text: 'Notify provider for MAP < 65 or urine output < 30 mL/hr x 2 hours' }],
      meds: [
        { id: 'cefepime', name: 'Cefepime', dose: '2 g', route: 'IVPB', freq: 'Every 8 hours', type: 'scheduled', indication: 'Pneumonia / sepsis' },
        { id: 'vanco', name: 'Vancomycin', dose: '1,250 mg', route: 'IVPB', freq: 'Every 12 hours', type: 'scheduled', instructions: 'Trough before the 4th dose.' },
        { id: 'norepi', name: 'Norepinephrine 4 mg in 250 mL NS', dose: '4 mcg/min', route: 'IV', freq: 'Continuous — titrate to MAP ≥ 65', type: 'continuous', rate: '15 mL/hr', highAlert: true },
        { id: 'lr', name: 'Lactated Ringer\'s', dose: '100 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', rate: '100 mL/hr' },
        { id: 'lispro', name: 'Insulin lispro (sliding scale)', dose: 'per scale', route: 'Subcut', freq: 'Every 6 hours', type: 'scheduled', preAssess: ['Glucose'], highAlert: true, instructions: 'BG 150–199: 2 units; 200–249: 4 units; 250–299: 6 units; > 300: call provider.' }],
      vitals: [vs('05:00', 101.6, 112, 24, 92, 54, 92, 'Nasal cannula', 2, null, { o2Flow: 4 }), vs('07:00', 100.9, 104, 22, 104, 60, 94, 'Nasal cannula', 2, null, { o2Flow: 4 })],
      labs: [cbc('tst-whitaker-cbc', '04:00', 18.9, 12.4, 37, 132), bmp('tst-whitaker-bmp', '04:00', 134, 3.4, 99, 19, 32, 1.6, 212),
        { id: 'tst-whitaker-lac', panel: 'Lactate', time: '04:00', results: [{ t: 'Lactate', v: '2.6', u: 'mmol/L', lo: 0.5, hi: 2.2 }] }],
      imaging: [{ id: 'tst-whitaker-cxr', study: 'Chest X-ray portable', time: '20:00', day: -1, text: 'IMPRESSION: Left lower lobe consolidation.' }]
    }),
    pt({
      id: 'tst-delgado', name: { first: 'Rosa', last: 'Delgado' }, mrn: 'TE100104', dob: '1967-04-22', age: '59 years', sex: 'F',
      unit: 'Intensive Care Unit', room: 'ICU-05', attending: 'Dr. Mei Chen', service: 'Critical Care',
      vitalsOrder: 'Vital signs every 1 hour', diet: 'NPO except ice chips', admitDx: 'Diabetic ketoacidosis', chiefComplaint: 'Nausea, vomiting, and high blood sugar',
      allergies: [{ agent: 'Sulfa drugs', reaction: 'Rash', severity: 'Moderate', tags: ['sulfa'] }], heightCm: 160, weightKg: 64, language: 'Spanish', interpreter: true,
      demographics: { 'Primary language': 'Spanish', 'Interpreter needed': 'Yes', Insurance: 'Medicaid' },
      hpi: 'Type 1 diabetic who ran out of insulin 3 days ago. Vomiting, abdominal pain, and Kussmaul respirations. Glucose 486, pH 7.18 on arrival.',
      pmh: ['Type 1 diabetes'], homeMeds: [{ name: 'Insulin glargine', dose: '18 units', route: 'Subcut', freq: 'At bedtime' }],
      plan: ['Insulin infusion per DKA protocol', 'Potassium replacement', 'Hourly glucose; BMP every 2 hours', 'Spanish interpreter for all teaching'],
      orders: [{ cat: 'Lab', text: 'Point-of-care glucose every 1 hour' }, { cat: 'Lab', text: 'BMP every 2 hours' }, { cat: 'Nursing', text: 'I & O every 1 hour' },
        { cat: 'Nursing', text: 'Use a Spanish medical interpreter for all assessments and teaching' }],
      meds: [
        { id: 'insgtt', name: 'Insulin regular 100 units in 100 mL NS', dose: '6.4 units/hr', route: 'IV', freq: 'Continuous — DKA protocol', type: 'continuous', rate: '6.4 mL/hr', highAlert: true },
        { id: 'ns', name: '0.9% Sodium chloride', dose: '150 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', rate: '150 mL/hr' },
        { id: 'kcl', name: 'Potassium chloride 20 mEq in 100 mL', dose: '20 mEq', route: 'IVPB', freq: 'Every 2 hours PRN potassium < 4.0', type: 'prn', indication: 'Potassium < 4.0 mEq/L', preAssess: ['lab:Potassium'], highAlert: true },
        { id: 'ondan', name: 'Ondansetron', dose: '4 mg', route: 'IV push', freq: 'Every 6 hours PRN nausea', type: 'prn', indication: 'Nausea or vomiting', minIntervalHr: 6 }],
      vitals: [vs('05:00', 99.1, 118, 28, 108, 64, 98, 'Room air', 4), vs('07:00', 98.9, 106, 24, 112, 68, 98, 'Room air', 3)],
      labs: [bmp('tst-delgado-bmp0', '22:00', 131, 5.6, 96, 8, 28, 1.3, 486, -1), bmp('tst-delgado-bmp', '06:00', 136, 3.7, 104, 15, 22, 1.0, 212)]
    }),

    /* ---------------- Progressive Care / Telemetry ---------------- */
    pt({
      id: 'tst-nguyen', name: { first: 'Thomas', last: 'Nguyen' }, mrn: 'TE100105', dob: '1949-09-17', age: '77 years', sex: 'M',
      unit: 'Progressive Care Unit', room: 'PCU-14', attending: 'Dr. Aaron Feld', service: 'Cardiology', codeStatus: 'DNR',
      advanceDirective: 'DNR — living will on file', admitDx: 'Atrial fibrillation with rapid ventricular response', chiefComplaint: 'Palpitations and dizziness',
      heightCm: 170, weightKg: 74, flags: ['DNR', 'Continuous ECG', 'Fall Risk'],
      hpi: 'Palpitations and lightheadedness since yesterday. Heart rate 150s in atrial fibrillation; converted to rate control on diltiazem.',
      pmh: ['Atrial fibrillation', 'Hypertension', 'Benign prostatic hyperplasia'],
      homeMeds: [{ name: 'Metoprolol tartrate', dose: '25 mg', route: 'PO', freq: 'BID' }, { name: 'Tamsulosin', dose: '0.4 mg', route: 'PO', freq: 'At bedtime' }],
      plan: ['Diltiazem infusion; transition to oral', 'Start apixaban', 'Fall precautions'],
      orders: [{ cat: 'Nursing', text: 'Continuous ECG monitoring' }, { cat: 'Nursing', text: 'Notify provider for HR > 120 or < 50' }, { cat: 'Activity', text: 'Up with assistance only', at: -20, isNew: true }],
      meds: [
        { id: 'dilt', name: 'Diltiazem 125 mg in 125 mL D5W', dose: '10 mg/hr', route: 'IV', freq: 'Continuous', type: 'continuous', rate: '10 mL/hr', highAlert: true },
        { id: 'metop', name: 'Metoprolol tartrate', dose: '25 mg', route: 'PO', freq: 'BID', type: 'scheduled', preAssess: ['HR', 'SBP'], holdIf: [{ p: 'HR', op: '<', v: 55 }, { p: 'SBP', op: '<', v: 100 }] },
        { id: 'apix', name: 'Apixaban', dose: '5 mg', route: 'PO', freq: 'BID', type: 'scheduled', highAlert: true },
        { id: 'tams', name: 'Tamsulosin', dose: '0.4 mg', route: 'PO', freq: 'At bedtime', type: 'scheduled' }],
      vitals: [vs('04:00', 98.0, 104, 18, 128, 78, 96, 'Room air', 0), vs('07:45', 98.2, 92, 16, 124, 74, 97, 'Room air', 0)],
      labs: [bmp('tst-nguyen-bmp', '05:00', 140, 4.4, 104, 26, 18, 1.1, 98), { id: 'tst-nguyen-mg', panel: 'Magnesium / TSH', time: '05:00', results: [{ t: 'Magnesium', v: '1.9', u: 'mg/dL', lo: 1.7, hi: 2.4 }, { t: 'TSH', v: '2.1', u: 'mIU/L', lo: 0.4, hi: 4.0 }] }]
    }),
    pt({
      id: 'tst-brooks', name: { first: 'Angela', last: 'Brooks' }, mrn: 'TE100106', dob: '1960-01-29', age: '66 years', sex: 'F',
      unit: 'Telemetry Unit', room: '220-1', attending: 'Dr. Aaron Feld', service: 'Cardiology', diet: '2 g sodium, 1.5 L fluid restriction',
      admitDx: 'Acute on chronic heart failure exacerbation', chiefComplaint: 'Shortness of breath and leg swelling',
      heightCm: 165, weightKg: 91, flags: ['Daily weight', 'Fluid restriction'],
      hpi: 'Five-pound weight gain in a week, orthopnea, and 2+ pitting edema to both legs. Ran out of furosemide.',
      pmh: ['Heart failure (EF 30%)', 'Hypertension', 'Type 2 diabetes'],
      homeMeds: [{ name: 'Furosemide', dose: '40 mg', route: 'PO', freq: 'Daily' }, { name: 'Lisinopril', dose: '10 mg', route: 'PO', freq: 'Daily' }, { name: 'Carvedilol', dose: '12.5 mg', route: 'PO', freq: 'BID' }],
      plan: ['IV furosemide', 'Daily weight, strict I&O', 'Heart failure education'],
      orders: [{ cat: 'Nursing', text: 'Daily weight before breakfast' }, { cat: 'Nursing', text: 'Strict I & O' }, { cat: 'Lab', text: 'BMP daily' }],
      meds: [
        { id: 'furo', name: 'Furosemide', dose: '40 mg', route: 'IV push', freq: 'BID', type: 'scheduled', preAssess: ['SBP', 'lab:Potassium'], holdIf: [{ p: 'SBP', op: '<', v: 90 }] },
        { id: 'lisin', name: 'Lisinopril', dose: '10 mg', route: 'PO', freq: 'Daily', type: 'scheduled', preAssess: ['SBP'], holdIf: [{ p: 'SBP', op: '<', v: 100 }] },
        { id: 'carv', name: 'Carvedilol', dose: '12.5 mg', route: 'PO', freq: 'BID', type: 'scheduled', preAssess: ['HR', 'SBP'], holdIf: [{ p: 'HR', op: '<', v: 60 }] },
        { id: 'kcl', name: 'Potassium chloride ER', dose: '20 mEq', route: 'PO', freq: 'Daily', type: 'scheduled' }],
      vitals: [vs('04:00', 98.1, 88, 22, 142, 86, 92, 'Nasal cannula', 0, null, { o2Flow: 2, weight: 91 }), vs('07:30', 98.3, 84, 20, 138, 82, 94, 'Nasal cannula', 0, null, { o2Flow: 2 })],
      labs: [bmp('tst-brooks-bmp', '05:00', 136, '3.6', 100, 28, 24, 1.3, 142), { id: 'tst-brooks-bnp', panel: 'BNP', time: '05:00', results: [{ t: 'BNP', v: 1240, u: 'pg/mL', lo: 0, hi: 100 }] }],
      io: [{ time: '22:00', day: -1, kind: 'out', cat: 'Urine — voided', amt: 900 }, { time: '06:00', kind: 'out', cat: 'Urine — voided', amt: 650 }, { time: '06:00', kind: 'in', cat: 'PO', amt: 480 }]
    }),

    /* ---------------- Medical-Surgical / Orthopedics ---------------- */
    pt({
      id: 'tst-hughes', name: { first: 'Walter', last: 'Hughes' }, mrn: 'TE100107', dob: '1955-06-08', age: '71 years', sex: 'M',
      unit: 'Orthopedic Unit', room: '412-2', attending: 'Dr. Lena Ortiz', service: 'Orthopedics', noteType: 'Post-op Progress Note — POD 1',
      admitted: { time: '13:00', day: -1 }, activity: 'Weight bearing as tolerated with walker; physical therapy', admitDx: 'Post-op day 1 — right total knee arthroplasty', chiefComplaint: 'Elective right knee replacement',
      allergies: [{ agent: 'Penicillin', reaction: 'Hives', severity: 'Moderate', tags: ['penicillin'] }], heightCm: 183, weightKg: 96, flags: ['Fall Risk', 'Post-op'],
      hpi: 'Elective right total knee arthroplasty yesterday for osteoarthritis. Spinal anesthesia; EBL 200 mL. Pain controlled on oral medications.',
      pmh: ['Osteoarthritis', 'Obstructive sleep apnea (uses CPAP)'], psh: ['Right total knee arthroplasty — yesterday'],
      plan: ['Multimodal pain control', 'Enoxaparin for DVT prevention', 'PT twice daily', 'CPAP at night'],
      orders: [{ cat: 'Nursing', text: 'Neurovascular checks right leg every 4 hours' }, { cat: 'Nursing', text: 'Ice to right knee 20 minutes every 2 hours' }, { cat: 'Respiratory', text: 'CPAP at night with home settings' }],
      meds: [
        { id: 'apap', name: 'Acetaminophen', dose: '1,000 mg', route: 'PO', freq: 'Every 6 hours', type: 'scheduled' },
        { id: 'enox', name: 'Enoxaparin', dose: '30 mg', route: 'Subcut', freq: 'Every 12 hours', type: 'scheduled', highAlert: true },
        { id: 'oxy', name: 'Oxycodone', dose: '5 mg', route: 'PO', freq: 'Every 4 hours PRN moderate pain (4–6)', type: 'prn', indication: 'Moderate pain', preAssess: ['Pain', 'RR'], minIntervalHr: 4 },
        { id: 'oxy10', name: 'Oxycodone', dose: '10 mg', route: 'PO', freq: 'Every 4 hours PRN severe pain (7–10)', type: 'prn', indication: 'Severe pain', preAssess: ['Pain', 'RR'], minIntervalHr: 4 },
        { id: 'docusate', name: 'Docusate sodium', dose: '100 mg', route: 'PO', freq: 'BID', type: 'scheduled' }],
      vitals: [vs('04:00', 99.3, 82, 16, 136, 78, 95, 'Room air', 5), vs('07:30', 99.0, 80, 16, 132, 76, 96, 'Room air', 4)],
      labs: [cbc('tst-hughes-cbc', '05:00', 10.2, '11.6', 34, 210), bmp('tst-hughes-bmp', '05:00', 138, 4.2, 102, 25, 16, 0.9, 128)]
    }),
    pt({
      id: 'tst-robinson', name: { first: 'Denise', last: 'Robinson' }, mrn: 'TE100108', dob: '1972-12-03', age: '53 years', sex: 'F',
      unit: 'Medical-Surgical Unit', room: '307-2', attending: 'Dr. Marcus Webb', diet: 'Consistent carbohydrate diet', admitDx: 'Cellulitis of the left lower leg', chiefComplaint: 'Red, painful, swollen left leg',
      heightCm: 168, weightKg: 104, flags: ['Diabetic'],
      hpi: 'Redness and swelling of the left shin spreading over 3 days, with fever to 100.9 °F. Outlined border marked in the ED.',
      pmh: ['Type 2 diabetes', 'Obesity'], homeMeds: [{ name: 'Metformin', dose: '1000 mg', route: 'PO', freq: 'BID' }],
      plan: ['IV cefazolin', 'Mark and monitor the border of redness every shift', 'Basal-bolus insulin; hold metformin', 'Elevate the leg'],
      orders: [{ cat: 'Nursing', text: 'Mark borders of erythema; assess every shift' }, { cat: 'Lab', text: 'Point-of-care glucose before meals and at bedtime' }, { cat: 'Nursing', text: 'Elevate left leg on pillows' }],
      meds: [
        { id: 'cefaz', name: 'Cefazolin', dose: '2 g', route: 'IVPB', freq: 'Every 8 hours', type: 'scheduled', indication: 'Cellulitis' },
        { id: 'glarg', name: 'Insulin glargine', dose: '20 units', route: 'Subcut', freq: 'At bedtime', type: 'scheduled', highAlert: true },
        { id: 'lispro', name: 'Insulin lispro (correction scale)', dose: 'per scale', route: 'Subcut', freq: 'AC & HS', type: 'scheduled', preAssess: ['Glucose'], highAlert: true, instructions: 'BG 151–200: 2 units; 201–250: 4 units; 251–300: 6 units; > 300: call provider.' },
        { id: 'apap', name: 'Acetaminophen', dose: '650 mg', route: 'PO', freq: 'Every 6 hours PRN pain or fever', type: 'prn', indication: 'Pain or temperature > 100.4 °F', preAssess: ['Pain'], minIntervalHr: 6 }],
      vitals: [vs('04:00', 100.2, 94, 18, 134, 82, 97, 'Room air', 5), vs('07:30', 99.6, 88, 18, 130, 80, 97, 'Room air', 4)],
      labs: [cbc('tst-robinson-cbc', '05:00', 13.8, 12.9, 38, 290), bmp('tst-robinson-bmp', '05:00', 137, 4.0, 101, 24, 15, 0.8, 186)]
    }),
    pt({
      id: 'tst-ali', name: { first: 'Samir', last: 'Ali' }, mrn: 'TE100109', dob: '1945-03-25', age: '81 years', sex: 'M',
      unit: 'Medical-Surgical Unit', room: '310-1', attending: 'Dr. Marcus Webb', activity: 'Up with assistance only; bed alarm on', admitDx: 'Urinary tract infection with acute confusion', chiefComplaint: 'New confusion and a fall at home',
      heightCm: 172, weightKg: 66, flags: ['Fall Risk', 'Bed alarm'], assessmentForms: ['wdl-adult', 'pain', 'morse', 'braden', 'mse'],
      hpi: 'Daughter reports 2 days of new confusion and a fall at home without injury. Urinalysis positive for nitrites and leukocytes.',
      pmh: ['Benign prostatic hyperplasia', 'Mild cognitive impairment', 'Hypertension'],
      homeMeds: [{ name: 'Tamsulosin', dose: '0.4 mg', route: 'PO', freq: 'At bedtime' }, { name: 'Amlodipine', dose: '5 mg', route: 'PO', freq: 'Daily' }],
      plan: ['Ceftriaxone', 'Delirium precautions; reorient often', 'Fall precautions with bed alarm'],
      orders: [{ cat: 'Nursing', text: 'Delirium precautions: reorient, glasses on, lights on during the day' }, { cat: 'Nursing', text: 'Bladder scan every 6 hours; straight cath for > 400 mL' }],
      meds: [
        { id: 'ceftri', name: 'Ceftriaxone', dose: '1 g', route: 'IVPB', freq: 'Daily', type: 'scheduled', indication: 'Urinary tract infection' },
        { id: 'tams', name: 'Tamsulosin', dose: '0.4 mg', route: 'PO', freq: 'At bedtime', type: 'scheduled' },
        { id: 'amlod', name: 'Amlodipine', dose: '5 mg', route: 'PO', freq: 'Daily', type: 'scheduled', preAssess: ['SBP'], holdIf: [{ p: 'SBP', op: '<', v: 100 }] }],
      vitals: [vs('04:00', 100.6, 98, 18, 118, 70, 96, 'Room air', 0), vs('07:30', 99.4, 90, 18, 122, 72, 97, 'Room air', 0)],
      labs: [cbc('tst-ali-cbc', '05:00', 14.6, 13.1, 39, 220), bmp('tst-ali-bmp', '05:00', 141, 4.3, 104, 24, 26, 1.2, 112),
        { id: 'tst-ali-ua', panel: 'Urinalysis', time: '19:30', day: -1, results: [{ t: 'Nitrite', v: 'Positive', ref: 'Negative', flag: 'A' }, { t: 'Leukocyte esterase', v: 'Large', ref: 'Negative', flag: 'A' }, { t: 'WBC (urine)', v: '> 50', u: '/hpf', ref: '0–5', flag: 'A' }] }]
    }),
    pt({
      id: 'tst-turner', name: { first: 'Robert', last: 'Turner' }, mrn: 'TE100110', dob: '1968-08-19', age: '58 years', sex: 'M',
      unit: 'Surgical Unit', room: '318-1', attending: 'Dr. Lena Ortiz', service: 'General Surgery', diet: 'NPO', activity: 'Up as tolerated; ambulate 3 times daily',
      admitDx: 'Small bowel obstruction', chiefComplaint: 'Abdominal pain, bloating, and vomiting',
      heightCm: 176, weightKg: 80, flags: ['NG tube to low suction'],
      hpi: 'Crampy abdominal pain and bilious vomiting for 1 day; no bowel movement for 2 days. CT shows partial small bowel obstruction from adhesions.',
      pmh: ['Prior appendectomy and hernia repair'], psh: ['Appendectomy', 'Ventral hernia repair'],
      plan: ['Bowel rest, NG tube to low intermittent suction', 'IV fluids', 'Serial abdominal exams; surgery if no improvement'],
      orders: [{ cat: 'Nursing', text: 'NG tube to low intermittent suction; record output every shift' }, { cat: 'Nursing', text: 'I & O every 4 hours' }, { cat: 'Imaging', text: 'Abdominal X-ray in AM' }],
      meds: [
        { id: 'ivf', name: '0.9% Sodium chloride with 20 mEq KCl', dose: '125 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', rate: '125 mL/hr' },
        { id: 'pant', name: 'Pantoprazole', dose: '40 mg', route: 'IV push', freq: 'Daily', type: 'scheduled' },
        { id: 'morph', name: 'Morphine', dose: '2 mg', route: 'IV push', freq: 'Every 3 hours PRN severe pain', type: 'prn', indication: 'Severe pain (7–10)', preAssess: ['Pain', 'RR'], highAlert: true, minIntervalHr: 3 },
        { id: 'ondan', name: 'Ondansetron', dose: '4 mg', route: 'IV push', freq: 'Every 6 hours PRN nausea', type: 'prn', indication: 'Nausea or vomiting', minIntervalHr: 6 }],
      vitals: [vs('04:00', 99.0, 96, 18, 128, 80, 97, 'Room air', 6), vs('07:30', 98.8, 90, 18, 126, 78, 98, 'Room air', 4)],
      labs: [cbc('tst-turner-cbc', '05:00', 11.4, 15.2, 45, 260), bmp('tst-turner-bmp', '05:00', 133, '3.3', 95, 30, 24, 1.1, 118)],
      imaging: [{ id: 'tst-turner-ct', study: 'CT abdomen and pelvis with contrast', time: '20:00', day: -1, text: 'IMPRESSION: Partial small bowel obstruction with a transition point in the right lower quadrant, likely adhesions.' }],
      io: [{ time: '22:00', day: -1, kind: 'out', cat: 'NG tube', amt: 350 }, { time: '06:00', kind: 'out', cat: 'NG tube', amt: 420 }, { time: '06:00', kind: 'out', cat: 'Urine — voided', amt: 500 }]
    }),

    /* ---------------- Labor & Delivery ---------------- */
    pt({
      id: 'tst-lopez', name: { first: 'Maria', last: 'Lopez' }, mrn: 'TE100111', dob: '1999-05-14', age: '27 years', sex: 'F',
      unit: 'Labor & Delivery', room: 'LDR-4', attending: 'Dr. Hannah Brooks-Lee', service: 'Obstetrics', diet: 'Clear liquids', activity: 'Up ad lib; ambulate in room',
      admitted: { at: -240 }, vitalsOrder: 'Vital signs every 1 hour; continuous fetal monitoring', admitDx: 'Intrauterine pregnancy at 39 weeks — induction of labor', chiefComplaint: 'Scheduled induction of labor',
      heightCm: 160, weightKg: 78, flags: ['GBS positive', 'Continuous fetal monitoring'], assessmentForms: ['wdl-adult', 'pain'],
      hpi: 'G2P1 at 39 weeks 2 days admitted for induction for gestational hypertension. Cervix 3 cm / 60% / -2. GBS positive.',
      pmh: ['Gestational hypertension'], psh: ['Spontaneous vaginal delivery (2022)'],
      plan: ['Oxytocin per protocol', 'Penicillin G for GBS prophylaxis', 'Continuous fetal monitoring', 'Epidural on request'],
      orders: [{ cat: 'Nursing', text: 'Continuous electronic fetal monitoring' }, { cat: 'Nursing', text: 'Notify provider for BP ≥ 160/110 or category II/III tracing' }],
      meds: [
        { id: 'pit', name: 'Oxytocin 30 units in 500 mL LR', dose: '2 milliunits/min', route: 'IV', freq: 'Continuous — increase 2 milliunits/min every 30 minutes per protocol', type: 'continuous', rate: '2 mL/hr', highAlert: true },
        { id: 'lr', name: 'Lactated Ringer\'s', dose: '125 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', rate: '125 mL/hr' },
        { id: 'pcn', name: 'Penicillin G potassium', dose: '2.5 million units', route: 'IVPB', freq: 'Every 4 hours until delivery', type: 'scheduled', tags: ['penicillin'], instructions: 'Loading dose of 5 million units given on admission.' },
        { id: 'fent', name: 'Fentanyl', dose: '50 mcg', route: 'IV push', freq: 'Every 1 hour PRN labor pain', type: 'prn', indication: 'Labor pain', preAssess: ['Pain', 'RR'], highAlert: true, minIntervalHr: 1 }],
      vitals: [vs('05:00', 98.2, 84, 18, 138, 88, 99, 'Room air', 3), vs('07:00', 98.4, 88, 18, 142, 90, 99, 'Room air', 5)],
      labs: [cbc('tst-lopez-cbc', '04:30', 10.8, '11.9', 35, 198), { id: 'tst-lopez-tc', panel: 'Type and Screen', time: '04:30', results: [{ t: 'ABO/Rh (blood type)', v: 'O+' }, { t: 'Antibody screen', v: 'Negative', ref: 'Negative' }] }],
      bloodType: 'O+'
    }),

    /* ---------------- Pediatrics ---------------- */
    pt({
      id: 'tst-bennett', name: { first: 'Noah', last: 'Bennett' }, mrn: 'TE100112', dob: '2020-02-20', age: '6 years', sex: 'M',
      unit: 'Pediatric Unit', room: 'PEDS-08', attending: 'Dr. Olivia Grant', service: 'Pediatrics', isolation: 'Contact (enteric)', diet: 'Clear liquids; advance as tolerated',
      admitDx: 'Acute gastroenteritis with moderate dehydration', chiefComplaint: 'Vomiting and diarrhea for 2 days',
      heightCm: 116, weightKg: 20, flags: ['Weight 20 kg', 'Contact precautions'], assessmentForms: ['wdl-adult', 'pain'], emergencyContact: 'Mother — at bedside',
      hpi: 'Two days of vomiting and watery diarrhea; decreased urine output. Dry mucous membranes and capillary refill 3 seconds on arrival.',
      pmh: ['Immunizations up to date'],
      plan: ['IV fluid bolus completed; maintenance fluids', 'Ondansetron PRN', 'Oral rehydration trial', 'Strict I&O; weigh diapers/stools'],
      orders: [{ cat: 'Nursing', text: 'Strict I & O' }, { cat: 'Nursing', text: 'Daily weight' }, { cat: 'Nursing', text: 'Contact precautions (enteric)' }],
      meds: [
        { id: 'ivf', name: 'D5 ½ NS with 20 mEq KCl', dose: '60 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', rate: '60 mL/hr' },
        { id: 'ondan', name: 'Ondansetron', dose: '3 mg', route: 'PO (ODT)', freq: 'Every 8 hours PRN nausea', type: 'prn', indication: 'Nausea or vomiting (0.15 mg/kg)', minIntervalHr: 8 },
        { id: 'apap', name: 'Acetaminophen 160 mg/5 mL', dose: '300 mg', route: 'PO', freq: 'Every 6 hours PRN fever or pain', type: 'prn', indication: 'Fever or pain (15 mg/kg)', preAssess: ['Pain'], minIntervalHr: 6 }],
      vitals: [vs('04:00', 99.8, 118, 24, 98, 60, 99, 'Room air', 2), vs('07:30', 99.2, 108, 22, 100, 62, 99, 'Room air', 1)],
      vitalRanges: { hr: [70, 120], rr: [18, 25], sbp: [90, 115] },
      labs: [bmp('tst-bennett-bmp', '05:00', 134, '3.5', 100, 18, 22, 0.5, 92)],
      io: [{ time: '22:00', day: -1, kind: 'in', cat: 'IV', amt: 400 }, { time: '06:00', kind: 'in', cat: 'IV', amt: 480 }, { time: '06:00', kind: 'out', cat: 'Urine — voided', amt: 210 }]
    }),

    /* ---------------- Behavioral Health ---------------- */
    pt({
      id: 'tst-fischer', name: { first: 'Emily', last: 'Fischer' }, mrn: 'TE100113', dob: '1992-10-09', age: '34 years', sex: 'F',
      unit: 'Behavioral Health Unit', room: 'BH-06', attending: 'Dr. Samuel Price', service: 'Psychiatry', activity: 'Unit restricted; safety checks every 15 minutes',
      vitalsOrder: 'Vital signs every shift', admitDx: 'Major depressive disorder, recurrent, severe — with suicidal ideation', chiefComplaint: 'Depression with thoughts of self-harm',
      allergies: [{ agent: 'Latex', reaction: 'Contact dermatitis', severity: 'Mild', tags: ['latex'] }], heightCm: 165, weightKg: 58,
      flags: ['Suicide precautions', 'Safety checks every 15 minutes'], assessmentForms: ['wdl-adult', 'mse', 'pain', 'morse'],
      hpi: 'Voluntary admission for worsening depression over 2 months, poor sleep, and passive thoughts of suicide without a plan. Stopped her medication 6 weeks ago.',
      pmh: ['Major depressive disorder', 'Generalized anxiety disorder'], socialHx: ['Lives alone; works as an accountant', 'Alcohol: 2–3 drinks per week'],
      homeMeds: [{ name: 'Sertraline', dose: '50 mg', route: 'PO', freq: 'Daily (stopped 6 weeks ago)' }],
      plan: ['Restart sertraline', 'Safety checks every 15 minutes; room free of ligature risks', 'Individual and group therapy'],
      orders: [{ cat: 'Nursing', text: 'Suicide precautions; safety checks every 15 minutes' }, { cat: 'Nursing', text: 'Search belongings; remove sharps and cords' }],
      meds: [
        { id: 'sert', name: 'Sertraline', dose: '50 mg', route: 'PO', freq: 'Daily', type: 'scheduled', instructions: 'Mouth check after administration.' },
        { id: 'traz', name: 'Trazodone', dose: '50 mg', route: 'PO', freq: 'At bedtime PRN sleep', type: 'prn', indication: 'Insomnia', minIntervalHr: 12 },
        { id: 'hydrox', name: 'Hydroxyzine', dose: '25 mg', route: 'PO', freq: 'Every 6 hours PRN anxiety', type: 'prn', indication: 'Anxiety', minIntervalHr: 6 }],
      vitals: [vs('20:00', 98.0, 76, 16, 112, 70, 99, 'Room air', 0, -1), vs('07:00', 97.9, 72, 14, 110, 68, 99, 'Room air', 0)],
      labs: [cbc('tst-fischer-cbc', '05:00', 6.4, 12.8, 38, 230), bmp('tst-fischer-bmp', '05:00', 140, 4.0, 104, 26, 12, 0.7, 88)]
    })
  ];
})();
