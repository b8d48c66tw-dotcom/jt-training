// Settings: backup and restore, preferences, program editor, install help.
import { state, replaceState, resetState } from '../store.js';
import * as U from '../util.js';
import { on, card, field, commit, toast, go } from '../core.js';
import { rerender } from '../core.js';
import { englishVoices, pickVoice, say, beepShort, beepChange, beepDone, unlockAudio, audioStatus } from '../timer.js';

// ---- export / import ----------------------------------------------------------------------
async function shareOrDownload(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const file = new File([blob], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: filename }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return true;
}

on('export-json', async () => {
  const stamp = U.today();
  const backup = { app: 'jt-training', exported: new Date().toISOString(), state };
  const ok = await shareOrDownload(JSON.stringify(backup, null, 1), `jt-training-backup-${stamp}.json`, 'application/json');
  if (ok) {
    state.meta.lastBackup = `${U.today()}T${new Date().toTimeString().slice(0, 5)}`; // local time
    await commit();
    toast('Backup saved');
  }
});

const csvCell = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');

on('export-csv-activities', () => {
  const rows = [['date', 'type', 'title', 'run_kind', 'distance_km', 'duration', 'pace_per_km', 'avg_hr', 'felt', 'effort', 'rounds', 'exercises', 'notes', 'source', 'plan_id']];
  for (const a of [...state.activities].sort((x, y) => (x.date < y.date ? -1 : 1))) {
    const ex = (a.exercises || []).filter((e) => e.reps?.length).map((e) => `${e.name}${e.weight ? ` ${e.weight}kg` : ''} x ${e.reps.join('/')}`).join('; ');
    rows.push([a.date, a.type, a.title, a.runKind, a.distanceKm, a.durationSec ? U.fmtDuration(a.durationSec) : '', a.type === 'run' ? U.fmtPace(U.paceSec(a.distanceKm, a.durationSec)).replace('/km', '') : '', a.avgHr, a.felt, a.effort, a.rounds, ex, a.notes, a.source, a.planId]);
  }
  shareOrDownload(toCsv(rows), `jt-training-activities-${U.today()}.csv`, 'text/csv');
});
on('export-csv-days', () => {
  const rows = [['date', 'weight_kg', 'mobility', 'shake', 'protein_target', 'water', 'veg', 'steps', 'kcal', 'protein_g']];
  for (const [d, x] of Object.entries(state.days).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const n = x.n || {};
    rows.push([d, x.weight, x.mobility ? 1 : 0, n.shake ? 1 : 0, n.protein ? 1 : 0, n.water ? 1 : 0, n.veg ? 1 : 0, n.steps ? 1 : 0, x.kcal, x.proteinG]);
  }
  shareOrDownload(toCsv(rows), `jt-training-daily-${U.today()}.csv`, 'text/csv');
});

on('import-json', async (el) => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const next = parsed.state || parsed;
    if (!next.settings || !next.program || !Array.isArray(next.activities)) throw new Error('Not a JT Training backup');
    const acts = next.activities.filter((a) => a.source !== 'strava').length;
    if (!confirm(`Restore this backup? It has ${acts} logged sessions and ${Object.keys(next.days || {}).length} daily entries, and replaces everything on this device.`)) { el.value = ''; return; }
    await replaceState(next);
    toast('Backup restored');
    go('#/today');
  } catch (e) {
    toast(`Could not import: ${e.message}`);
  }
  el.value = '';
});

on('reset-all', async () => {
  if (!confirm('Delete ALL logs and edits on this device and start fresh? Export a backup first.')) return;
  if (!confirm('Are you sure? This cannot be undone.')) return;
  await resetState();
  toast('Reset done');
  go('#/today');
});

on('pref', (el) => {
  state.settings[el.dataset.key] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
  if (el.dataset.key === 'theme') {
    if (el.value === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = el.value;
  }
  commit();
});

export function renderSettings() {
  const s = state.settings;
  const last = state.meta.lastBackup;
  const age = last ? U.diffDays(last.slice(0, 10), U.today()) : null;
  let html = card(`<h2>Backup</h2>
    <p>${last ? `Last full backup: ${U.fmtDateYear(last.slice(0, 10))}${age ? ` (${age} days ago)` : ' (today)'}.` : 'No backup yet.'} Your data lives only on this device, so back up every Sunday.</p>
    <button class="btn btn-primary btn-lg btn-block" data-act="export-json">Export full backup (JSON)</button>
    <label class="btn btn-block file-btn">Restore from backup<input type="file" accept="application/json,.json" data-change="import-json"></label>
    <div class="btn-row"><button class="btn" data-act="export-csv-activities">Sessions CSV</button><button class="btn" data-act="export-csv-days">Daily CSV</button></div>
    <p class="muted">On iPhone the share sheet opens - pick Save to Files and choose OneDrive or iCloud Drive.</p>`, age == null || age >= 7 ? 'card-warn' : '');

  html += card(`<h2>Goals and targets</h2>
    <p>${s.startWeight} kg to ${s.goalWeight} kg by ${U.fmtDateYear(s.goalDate)}. ${s.targets.kcal} kcal, ${s.targets.proteinLow} - ${s.targets.proteinHigh} g protein. HR cap ${s.hrCapLow} - ${s.hrCapHigh} bpm.</p>
    <a class="btn btn-block" href="#/edit/targets">Edit goals and targets</a>`);

  html += card(`<h2>Program</h2><p class="muted">Everything in the program is editable. Changes apply straight away.</p>
    <div class="add-grid">
      <a class="btn" href="#/edit/equipment">Equipment</a>
      <a class="btn" href="#/edit/exercises">Exercises and swaps</a>
      <a class="btn" href="#/edit/strength">Strength sessions</a>
      <a class="btn" href="#/edit/weeks">Weeks, runs, finishers</a>
      <a class="btn" href="#/edit/mobility">Mobility drills</a>
      <a class="btn" href="#/edit/nutrition">Nutrition options</a>
    </div>
    <a class="btn btn-ghost btn-block" href="#/edit/advanced">Advanced: edit raw data</a>`);

  html += card(`<h2>Timer and display</h2>
    <label class="check"><input type="checkbox" data-change="pref" data-key="timerSound" ${s.timerSound ? 'checked' : ''}> Sounds (soft chimes)</label>
    <label class="check"><input type="checkbox" data-change="pref" data-key="timerVoice" ${s.timerVoice ? 'checked' : ''}> Voice cues (good with headphones)</label>
    <label class="check"><input type="checkbox" data-change="pref" data-key="timerVibrate" ${s.timerVibrate ? 'checked' : ''}> Vibrate (Android only, iPhone does not allow it)</label>
    ${field('Sound volume', `<input type="range" min="0" max="1" step="0.05" value="${s.timerVolume ?? 0.5}" data-change="pref" data-key="timerVolume" class="range">`)}
    ${field('Voice', `<select data-change="pref" data-key="timerVoiceName"><option value="">Most natural available (automatic)</option>${voiceOptions(s.timerVoiceName)}</select>`, 'For a softer, more human voice, download an Enhanced or Premium voice: iPhone Settings, Accessibility, Spoken Content, Voices, English. Then pick it here.')}
    <div class="btn-row"><button class="btn" data-act="test-sound">Test sounds</button><button class="btn" data-act="test-voice">Test voice</button></div>
    ${field('Theme', `<select data-change="pref" data-key="theme">${[['auto', 'Night Calm'], ['light', 'Light']].map(([v, l]) => `<option value="${v}" ${s.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}`);

  html += card(`<h2>Install on your iPhone</h2>
    <ol class="plain">
      <li>Open the app's web address in <b>Safari</b> (not Chrome).</li>
      <li>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Open it from the home screen icon. It runs full screen and works offline.</li>
    </ol>
    <h3>Backing up</h3>
    <ol class="plain">
      <li>Settings, <b>Export full backup</b>. Save it to Files, in OneDrive or iCloud Drive.</li>
      <li>To move to a new phone or the laptop, open the app there and tap <b>Restore from backup</b>.</li>
    </ol>
    <h3>Guided sessions</h3>
    <p class="muted">On gym days tap Start session. The timer runs the warm-up, each set, changeovers, round rests, the finisher and cool-down, with a photo of every exercise. Stop early or finish, then tap Log it - your rounds are filled in for you. Timings are in Goals and targets.</p>
    <h3>Interval timer</h3>
    <p class="muted">Keep the timer screen open. It keeps the screen awake and beeps at each change. iPhone pauses web apps when the screen locks, so beeps stop while locked, but the timer catches up when you unlock.</p>`, 'card-quiet');

  html += `<p class="muted center credit">Exercise photos: Free Exercise DB (github.com/yuhonas/free-exercise-db), public domain.</p>`;
  html += `<button class="btn btn-danger btn-block" data-act="reset-all">Reset all data</button>`;
  return { title: 'Settings', html };
}

// ---- timer voice and sound tests -------------------------------------------------------------------
function voiceOptions(current) {
  const list = englishVoices().sort((x, y) => x.name.localeCompare(y.name));
  return list.map((v) => `<option value="${U.esc(v.name)}" ${v.name === current ? 'selected' : ''}>${U.esc(v.name)} (${U.esc(v.lang)})${/premium|enhanced|natural|neural/i.test(v.name) ? ' - natural' : ''}</option>`).join('');
}
// Voices load after the page on some phones: refresh the list once they arrive.
if (window.speechSynthesis) speechSynthesis.addEventListener?.('voiceschanged', () => { if (location.hash.startsWith('#/settings')) rerender(); });
on('test-voice', () => {
  unlockAudio();
  const v = pickVoice();
  say(`Goblet squat. Round two of three. Twelve to fifteen reps.${v ? '' : ''}`, true);
  if (v) toast(`Voice: ${v.name}`);
});
on('test-sound', () => { unlockAudio(); setTimeout(() => toast(`Sound check: ${audioStatus()}`), 400); beepShort(); setTimeout(beepShort, 700); setTimeout(beepChange, 1500); setTimeout(beepDone, 3000); });

// ---- program editor -----------------------------------------------------------------------------
const UNITS = [['reps', 'reps'], ['each', 'reps each side'], ['sec', 'seconds'], ['secEach', 'seconds each side'], ['m', 'metres']];
const KINDS = [['runwalk', 'Run/walk'], ['easy', 'Easy'], ['long', 'Long easy'], ['tempo', 'Tempo']];
const optionFields = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'detail', label: 'What goes in it', type: 'textarea' },
  { key: 'kcal', label: 'kcal', type: 'num', half: true },
  { key: 'protein', label: 'Protein g', type: 'num', half: true },
];
const runFields = (p, label) => [
  { key: `${p}.title`, label: `${label}: title`, type: 'text' },
  { key: `${p}.kind`, label: 'Type', type: 'select', options: KINDS, half: true },
  { key: `${p}.minutes`, label: 'About (min)', type: 'num', half: true },
  { key: `${p}.km`, label: 'Target km (optional)', type: 'num' },
  { key: `${p}.segments`, label: 'Timer steps (JSON)', type: 'json' },
];

const SECTIONS = {
  targets: { title: 'Goals and targets', blocks: [{ fields: [
    { key: 'settings.startWeight', label: 'Start weight (kg)', type: 'num', half: true },
    { key: 'settings.goalWeight', label: 'Goal weight (kg)', type: 'num', half: true },
    { key: 'settings.goalDate', label: 'Goal date', type: 'date' },
    { key: 'settings.hrCapLow', label: 'Easy HR cap low', type: 'num', half: true },
    { key: 'settings.hrCapHigh', label: 'Easy HR cap high', type: 'num', half: true },
    { key: 'settings.easyPace', label: 'Easy pace guide', type: 'text', half: true },
    { key: 'settings.tempoPace', label: 'Tempo pace guide', type: 'text', half: true },
    { key: 'settings.targets.kcal', label: 'Daily kcal', type: 'num', half: true },
    { key: 'settings.targets.waterL', label: 'Water (L)', type: 'num', half: true },
    { key: 'settings.targets.proteinLow', label: 'Protein low (g)', type: 'num', half: true },
    { key: 'settings.targets.proteinHigh', label: 'Protein high (g)', type: 'num', half: true },
    { key: 'settings.targets.stepsLow', label: 'Steps low', type: 'num', half: true },
    { key: 'settings.targets.stepsHigh', label: 'Steps high', type: 'num', half: true },
    { key: 'settings.targets.fibreG', label: 'Fibre (g)', type: 'num' },
    { key: 'settings.longTermGoal', label: 'Longer-term goal', type: 'textarea' },
  ] }, { heading: 'Guided strength sessions (seconds)', fields: [
    { key: 'settings.timing.sessionMinutes', label: 'Session length (min)', type: 'num', half: true },
    { key: 'settings.timing.work', label: 'Work per set', type: 'num', half: true },
    { key: 'settings.timing.sideWork', label: 'Work per side (single-side moves)', type: 'num', half: true },
    { key: 'settings.timing.transition', label: 'Changeover between exercises', type: 'num', half: true },
    { key: 'settings.timing.roundRest', label: 'Rest between rounds', type: 'num', half: true },
    { key: 'settings.timing.switchSec', label: 'Switch sides', type: 'num', half: true },
    { key: 'settings.timing.warmup', label: 'Warm-up', type: 'num', half: true },
    { key: 'settings.timing.cooldown', label: 'Cool-down', type: 'num', half: true },
  ] }] },
  equipment: { title: 'Equipment', blocks: [{ fields: [
    { key: 'program.equipment', label: 'Equipment (one per line)', type: 'lines' },
    { key: 'settings.dumbbellPairs', label: 'Dumbbell pairs in kg (comma separated) - used for "go up" suggestions', type: 'nums' },
    { key: 'settings.dumbbellSingles', label: 'Single dumbbells in kg', type: 'nums' },
  ] }] },
  exercises: { title: 'Exercises and swaps', blocks: [{ list: 'program.exercises', itemTitle: (e) => e.name,
    newItem: () => ({ id: 'ex' + U.uid(), name: 'New exercise', min: 10, max: 12, unit: 'reps', load: true, cue: '', swaps: [] }),
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'min', label: 'Reps from', type: 'num', half: true },
      { key: 'max', label: 'Reps to (top of range)', type: 'num', half: true },
      { key: 'unit', label: 'Unit', type: 'select', options: UNITS, half: true },
      { key: 'load', label: 'Log a weight', type: 'check', half: true },
      { key: 'cue', label: 'Form cue', type: 'textarea' },
      { key: 'swaps', label: 'Swap options (one per line)', type: 'lines' },
      { key: 'work', label: 'Guided set time in sec (blank = default)', type: 'num' },
      { key: 'fromWeek', label: 'Change to a harder version from week', type: 'num', half: true },
      { key: 'laterName', label: 'Harder version name', type: 'text', half: true },
      { key: 'id', label: 'ID (used in strength sessions)', type: 'text', readonly: true },
    ] }] },
  strength: { title: 'Strength sessions', note: () => `Exercise IDs: ${state.program.exercises.map((e) => `${e.id} (${e.name})`).join(', ')}`,
    blocks: [['strengthA', 'Strength A'], ['strengthB', 'Strength B']].map(([k, heading]) => ({ heading, fields: [
      { key: `program.strength.${k}.title`, label: 'Title', type: 'text' },
      { key: `program.strength.${k}.subtitle`, label: 'Subtitle', type: 'text' },
      { key: `program.strength.${k}.minutes`, label: 'Minutes', type: 'num' },
      { key: `program.strength.${k}.warmup`, label: 'Warm-up', type: 'textarea' },
      { key: `program.strength.${k}.format`, label: 'Format', type: 'textarea' },
      { key: `program.strength.${k}.exercises`, label: 'Exercise IDs in order (one per line)', type: 'lines' },
    ] })) },
  weeks: { title: 'Weeks, runs, finishers', note: () => 'Timer steps: {"l": label, "s": seconds (0 = tap Next), "k": run | walk | tempo | jog | hard | easy | rest | warm | cool}. Repeat: {"x": rounds, "items": [...], "dropLast": true}.',
    blocks: [{ list: 'program.weeks', fixed: true, itemTitle: (w) => `Week ${w.n} - ${w.phase}`, fields: [
      { key: 'phase', label: 'Phase', type: 'text', half: true },
      { key: 'rounds', label: 'Strength rounds', type: 'num', half: true },
      { key: 'notes', label: 'Week notes', type: 'textarea' },
      ...runFields('tue', 'Tuesday run'),
      ...runFields('sun', 'Sunday run'),
      { key: 'finA.label', label: 'Strength A finisher', type: 'text' },
      { key: 'finA.segments', label: 'Finisher A timer steps (JSON)', type: 'json' },
      { key: 'finB.label', label: 'Strength B finisher', type: 'text' },
      { key: 'finB.segments', label: 'Finisher B timer steps (JSON)', type: 'json' },
    ] }] },
  mobility: { title: 'Mobility drills', blocks: [{ list: 'program.mobility', itemTitle: (m) => m.name,
    newItem: () => ({ id: 'mob' + U.uid(), name: 'New stretch', cue: '', hold: 40, sides: 2 }),
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'cue', label: 'Cue', type: 'textarea' },
      { key: 'hold', label: 'Hold (sec)', type: 'num', half: true },
      { key: 'sides', label: 'Sides (1 or 2)', type: 'num', half: true },
    ] }] },
  nutrition: { title: 'Nutrition options', blocks: [
    { list: 'nutrition.breakfast', heading: 'Breakfast', itemTitle: (o) => o.name, newItem: () => ({ name: 'New breakfast', detail: '', kcal: 400, protein: 35 }), fields: optionFields },
    { list: 'nutrition.lunch', heading: 'Lunch', itemTitle: (o) => o.name, newItem: () => ({ name: 'New lunch', detail: '', kcal: 500, protein: 45 }), fields: optionFields },
    { list: 'nutrition.snacks', heading: 'Snacks', itemTitle: (o) => o.name, newItem: () => ({ name: 'New snack', detail: '', kcal: 200, protein: 20 }), fields: optionFields },
    { heading: 'Guidance', fields: [
      { key: 'nutrition.portions', label: 'Portions (one per line)', type: 'lines' },
      { key: 'nutrition.dinner.guidance', label: 'Dinner guidance', type: 'lines' },
      { key: 'nutrition.dinner.ideas', label: 'Dinner ideas', type: 'lines' },
      { key: 'nutrition.earlySessions', label: '4am sessions', type: 'lines' },
      { key: 'nutrition.cricketGame', label: 'Saturday game day', type: 'lines' },
      { key: 'nutrition.cricketTraining', label: 'Thursday training', type: 'lines' },
      { key: 'nutrition.christmas', label: 'Silly season', type: 'lines' },
      { key: 'nutrition.tips', label: 'Tips', type: 'lines' },
    ] },
  ] },
};

function input(f, name, value) {
  const ro = f.readonly ? 'readonly' : '';
  switch (f.type) {
    case 'num': return `<input name="${name}" data-type="num" type="number" step="any" inputmode="decimal" value="${value ?? ''}" ${ro}>`;
    case 'date': return `<input name="${name}" data-type="text" type="date" value="${value ?? ''}">`;
    case 'textarea': return `<textarea name="${name}" data-type="text" rows="3">${U.esc(value ?? '')}</textarea>`;
    case 'lines': return `<textarea name="${name}" data-type="lines" rows="${Math.min(12, Math.max(3, (value || []).length + 1))}">${U.esc((value || []).join('\n'))}</textarea>`;
    case 'nums': return `<input name="${name}" data-type="nums" type="text" value="${(value || []).join(', ')}">`;
    case 'json': return `<textarea class="mono" name="${name}" data-type="json" rows="5">${U.esc(JSON.stringify(value ?? null))}</textarea>`;
    case 'check': return `<input name="${name}" data-type="check" type="checkbox" ${value ? 'checked' : ''}>`;
    case 'select': return `<select name="${name}" data-type="text">${f.options.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${U.esc(l)}</option>`).join('')}</select>`;
    default: return `<input name="${name}" data-type="text" type="text" value="${U.esc(value ?? '')}" ${ro}>`;
  }
}
function fieldsHtml(fields, prefix, obj) {
  return `<div class="ed-grid">${fields.map((f) => {
    const name = prefix ? `${prefix}.${f.key}` : f.key;
    const value = U.getPath(prefix ? obj : state, f.key);
    if (f.type === 'check') return `<label class="check ${f.half ? 'half' : ''}">${input(f, name, value)} ${U.esc(f.label)}</label>`;
    return `<label class="field ${f.half ? 'half' : ''}"><span class="lbl">${U.esc(f.label)}</span>${input(f, name, value)}</label>`;
  }).join('')}</div>`;
}

function applyEditor(form) {
  const updates = [];
  for (const el of form.elements) {
    if (!el.name || !el.dataset.type) continue;
    let v;
    switch (el.dataset.type) {
      case 'num': v = U.num(el.value); break;
      case 'check': v = el.checked; break;
      case 'lines': v = el.value.split('\n').map((x) => x.trim()).filter(Boolean); break;
      case 'nums': v = el.value.split(/[,\s]+/).map(U.num).filter((x) => x != null).sort((a, b) => a - b); break;
      case 'json':
        try { v = JSON.parse(el.value); } catch (e) { el.focus(); toast('That timer step data is not valid JSON'); return false; }
        break;
      default: v = el.value;
    }
    updates.push([el.name, v]);
  }
  for (const [path, v] of updates) U.setPath(state, path, v);
  return true;
}

on('ed-save', (form) => {
  if (form.dataset.section === 'advanced') {
    try {
      const data = JSON.parse(form.raw.value);
      if (!data.program || !data.nutrition) throw new Error('Needs program and nutrition');
      state.program = data.program;
      state.nutrition = data.nutrition;
    } catch (e) { return toast(`Not saved: ${e.message}`); }
  } else if (!applyEditor(form)) return;
  toast('Saved');
  commit(false);
});
on('ed-add', (el) => {
  const form = el.closest('form');
  if (!applyEditor(form)) return;
  const block = SECTIONS[form.dataset.section].blocks[Number(el.dataset.b)];
  U.getPath(state, block.list).push(block.newItem());
  commit();
});
on('ed-del', (el) => {
  const form = el.closest('form');
  if (!confirm('Remove this item?')) return;
  if (!applyEditor(form)) return;
  U.getPath(state, el.dataset.list).splice(Number(el.dataset.i), 1);
  commit();
});
on('ed-up', (el) => {
  const form = el.closest('form');
  if (!applyEditor(form)) return;
  const arr = U.getPath(state, el.dataset.list);
  const i = Number(el.dataset.i);
  if (i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
  commit();
});
export function renderEditor(key) {
  if (key === 'advanced') {
    return { title: 'Advanced', html: `<form data-submit="ed-save" data-section="advanced">
      <p class="muted">The whole program and nutrition data. Only change this if you know what you're doing - export a backup first.</p>
      <textarea class="mono raw" name="raw" rows="24">${U.esc(JSON.stringify({ program: state.program, nutrition: state.nutrition }, null, 2))}</textarea>
      <button class="btn btn-primary btn-xl btn-block">Save</button></form>` };
  }
  const sec = SECTIONS[key];
  if (!sec) return { title: 'Edit', html: '<p>Unknown section.</p>' };
  let html = `<form class="editor" data-submit="ed-save" data-section="${key}">`;
  if (sec.note) html += `<div class="note mono-note">${U.esc(sec.note())}</div>`;
  sec.blocks.forEach((b, bi) => {
    if (b.list) {
      const arr = U.getPath(state, b.list) || [];
      html += `${b.heading ? `<h2 class="ed-h">${U.esc(b.heading)}</h2>` : ''}`;
      html += arr.map((item, i) => `<details class="card ed-item"><summary>${U.esc(b.itemTitle(item))}</summary>
        ${fieldsHtml(b.fields, `${b.list}.${i}`, item)}
        ${b.fixed ? '' : `<div class="btn-row"><button type="button" class="btn btn-sm" data-act="ed-up" data-list="${b.list}" data-i="${i}">Move up</button><button type="button" class="btn btn-sm btn-danger" data-act="ed-del" data-list="${b.list}" data-i="${i}">Remove</button></div>`}
      </details>`).join('');
      if (!b.fixed) html += `<button type="button" class="btn btn-block" data-act="ed-add" data-b="${bi}">Add ${U.esc((b.heading || 'item').toLowerCase())}</button>`;
    } else {
      html += card(`${b.heading ? `<h2>${U.esc(b.heading)}</h2>` : ''}${fieldsHtml(b.fields, '', null)}`);
    }
  });
  html += `<div class="save-bar"><button class="btn btn-primary btn-xl btn-block">Save changes</button></div></form>`;
  return { title: sec.title, html };
}
