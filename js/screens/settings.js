// Settings: backup and restore, preferences, program editor, install help.
import { state, replaceState, resetState } from '../store.js';
import * as U from '../util.js';
import { on, card, field, commit, toast, go } from '../core.js';
import { rerender } from '../core.js';
import { englishVoices, beepShort, beepChange, beepDone, unlockAudio, audioStatus, speakParts, setAudioMode } from '../timer.js';

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
  if (el.dataset.key === 'musicMode') setAudioMode();
  if (el.dataset.key === 'theme') {
    if (el.value === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = el.value;
  }
  commit();
});

// Small line icons for settings rows.
const SI = {
  shield: '<path d="M24 5l15 6v11c0 10-6 17-15 21C15 39 9 32 9 22V11z"/><path d="M17 24l5 5 9-10"/>',
  restore: '<path d="M10 24a14 14 0 1 0 4-10M10 8v8h8"/>',
  file: '<path d="M14 6h14l8 8v28H14zM28 6v8h8M19 26h12M19 32h12"/>',
  target: '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="8"/><circle cx="24" cy="24" r="1.5"/>',
  gym: '<path d="M8 20v8M14 15v18M34 15v18M40 20v8M14 24h20"/>',
  swap: '<path d="M10 16h26l-6-6M38 32H12l6 6"/>',
  list: '<path d="M18 13h20M18 24h20M18 35h20M10 13h1M10 24h1M10 35h1"/>',
  calendar: '<rect x="8" y="10" width="32" height="30" rx="6"/><path d="M8 19h32M17 6v8M31 6v8"/>',
  stretch: '<circle cx="28" cy="9" r="4"/><path d="M14 22l10-6 8 5M24 16l-2 12 8 6v10M22 28l-8 6"/>',
  food: '<path d="M14 6v12a4 4 0 0 0 8 0V6M18 18v24M34 42V6c-5 3-6 9-6 14h6"/>',
  code: '<path d="M18 14L8 24l10 10M30 14l10 10-10 10"/>',
  sound: '<path d="M8 19h7l9-7v24l-9-7H8zM32 17a9 9 0 0 1 0 14M36 12a15 15 0 0 1 0 24"/>',
  voice: '<rect x="18" y="6" width="12" height="22" rx="6"/><path d="M12 22a12 12 0 0 0 24 0M24 34v8"/>',
  vibrate: '<rect x="16" y="8" width="16" height="32" rx="4"/><path d="M8 18v12M40 18v12"/>',
  music: '<path d="M18 36V10l20-4v26"/><circle cx="13" cy="36" r="5"/><circle cx="33" cy="32" r="5"/>',
  theme: '<path d="M30 8a16 16 0 1 0 10 26A14 14 0 0 1 30 8z"/>',
  phone: '<rect x="14" y="5" width="20" height="38" rx="5"/><path d="M21 37h6"/>',
  timer: '<circle cx="24" cy="27" r="14"/><path d="M24 27V19M20 6h8"/>',
  info: '<circle cx="24" cy="24" r="17"/><path d="M24 22v11M24 15v1"/>',
};
const sIcon = (k, tone = 'teal') => `<span class="sr-ic c-${tone}"><svg viewBox="0 0 48 48" aria-hidden="true">${SI[k] || ''}</svg></span>`;
const row = (href, ic, tone, title, sub) => `<a class="set-row" href="${href}">${sIcon(ic, tone)}<span class="sr-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="chev">&#8250;</span></a>`;
const toggle = (key, ic, tone, title, sub, on) => `<label class="set-row sw-row">${sIcon(ic, tone)}<span class="sr-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="switch" data-change="pref" data-key="${key}" ${on ? 'checked' : ''}></label>`;
const helpCard = (ic, tone, title, sub, body) => `<details class="guide g2-${tone}"><summary><span class="gi">${`<svg viewBox="0 0 48 48" aria-hidden="true">${SI[ic]}</svg>`}</span><span class="g-txt"><b>${title}</b><small>${sub}</small></span><span class="g-chev">+</span></summary><div class="g-body">${body}</div></details>`;

on('theme-set', (el) => {
  state.settings.theme = el.dataset.v;
  if (el.dataset.v === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = el.dataset.v;
  commit();
});
on('visuals-set', (el) => { state.settings.visuals = el.dataset.v; commit(); });

export function renderSettings() {
  const s = state.settings;
  const last = state.meta.lastBackup;
  const age = last ? U.diffDays(last.slice(0, 10), U.today()) : null;
  const P2 = state.program;
  let html = `<div class="page-head"><div class="disp disp-lg">Settings</div><div class="muted">Your goals, the program, sounds and backups.</div></div>`;

  // Profile / goal hero
  html += `<div class="set-hero">
    <div class="sh-top"><span class="sh-av">JT</span><div><div class="disp sh-name">${U.esc(s.name || 'Josh')}</div><div class="muted">${s.startWeight} kg to <b class="teal">${s.goalWeight} kg</b> by ${U.fmtDate(s.goalDate)}</div></div></div>
    <div class="tags sh-tags"><span class="tag">${s.targets.kcal.toLocaleString('en-AU')} kcal</span><span class="tag">${s.targets.proteinLow}-${s.targets.proteinHigh} g protein</span><span class="tag">HR &lt; ${s.hrCapHigh}</span><span class="tag">${s.timing.sessionMinutes} min sessions</span></div>
    <a class="cta cta-ghost cta-block" href="#/edit/targets">Edit goals and timings</a>
  </div>`;

  // Backup
  const ok = age != null && age < 7;
  html += `<div class="sec-h"><span>Backup</span><small>Data lives on this phone only</small></div>
  <div class="card backup ${ok ? '' : 'bk-warn'}">
    <div class="bk-top">${sIcon('shield', ok ? 'teal' : 'orange')}<div><b>${last ? (age === 0 ? 'Backed up today' : `Last backup ${age} day${age === 1 ? '' : 's'} ago`) : 'No backup yet'}</b><small>${ok ? 'You are covered.' : 'Back up every Sunday - it takes 10 seconds.'}</small></div></div>
    <button class="cta cta-block" data-act="export-json">Back up now</button>
    <div class="bk-row">
      <label class="bk-tile file-btn">${sIcon('restore', 'blue')}<span>Restore</span><input type="file" accept="application/json,.json" data-change="import-json"></label>
      <button class="bk-tile" data-act="export-csv-activities">${sIcon('file', 'violet')}<span>Sessions CSV</span></button>
      <button class="bk-tile" data-act="export-csv-days">${sIcon('file', 'violet')}<span>Daily CSV</span></button>
    </div>
    <p class="muted small">On iPhone the share sheet opens - pick Save to Files, then OneDrive or iCloud Drive.</p>
  </div>`;

  // Program
  html += `<div class="sec-h"><span>Program</span><small>Edit anything</small></div>
  <div class="set-group">
    ${row('#/edit/equipment', 'gym', 'teal', 'Equipment', `${P2.equipment.length} items`)}
    ${row('#/edit/exercises', 'swap', 'blue', 'Exercises and swaps', `${P2.exercises.length} exercises`)}
    ${row('#/edit/strength', 'list', 'violet', 'Strength sessions', 'Order, warm-ups, format')}
    ${row('#/edit/weeks', 'calendar', 'orange', 'Weeks, runs, finishers', `${P2.weeks.length} weeks`)}
    ${row('#/edit/mobility', 'stretch', 'teal', 'Mobility drills', `${P2.mobility.length} drills`)}
    ${row('#/edit/nutrition', 'food', 'orange', 'Nutrition options', 'Meals and guides')}
    ${row('#/edit/advanced', 'code', 'grey', 'Advanced', 'Edit the raw data')}
  </div>`;

  // Timer, sound and music
  html += `<div class="sec-h"><span>Sound and timer</span><small>Cues during sessions</small></div>
  <div class="set-group">
    ${toggle('timerSound', 'sound', 'teal', 'Chimes', 'Soft tones at each change', s.timerSound)}
    ${toggle('timerVoice', 'voice', 'blue', 'Voice cues', 'Recorded Australian voice', s.timerVoice)}
    ${toggle('musicMode', 'music', 'violet', 'Play over my music', 'Cues dip Spotify, then it comes back', s.musicMode !== false)}
    ${toggle('timerVibrate', 'vibrate', 'grey', 'Vibrate', 'Android only', s.timerVibrate)}
    <div class="set-row vol-row">${sIcon('sound', 'teal')}<span class="sr-t"><b>Volume</b><input type="range" min="0" max="1" step="0.05" value="${s.timerVolume ?? 0.6}" data-change="pref" data-key="timerVolume" class="range"></span></div>
  </div>
  <div class="test-row"><button class="bk-tile" data-act="test-sound">${sIcon('sound', 'teal')}<span>Test chimes</span></button><button class="bk-tile" data-act="test-voice">${sIcon('voice', 'blue')}<span>Test voice</span></button><button class="bk-tile" data-act="test-music">${sIcon('music', 'violet')}<span>Test with music</span></button></div>
  <div class="card">
    ${field('Workout playlist link', `<input type="url" data-change="pref" data-key="musicUrl" value="${U.esc(s.musicUrl || '')}" placeholder="https://open.spotify.com/playlist/...">`, 'In Spotify: playlist, then ..., Share, Copy link. Adds an "Open my workout playlist" button to the session start screen.')}
    ${s.musicUrl ? '<button class="btn btn-block" data-act="open-music">Open playlist</button>' : ''}
    <p class="muted small">In music mode keep the ring/silent switch off silent, or cues may be muted. Turn music mode off to have cues play through the silent switch (your music will pause).</p>
    ${field('Backup voice', `<select data-change="pref" data-key="timerVoiceName"><option value="">Automatic</option>${voiceOptions(s.timerVoiceName)}</select>`, 'Only reads anything without a recording, such as an exercise you add yourself.')}
  </div>`;

  // Display
  html += `<div class="sec-h"><span>Display</span></div>
  <div class="seg seg-theme">${[['auto', 'Night Calm'], ['light', 'Light']].map(([v, l]) => `<button class="${(s.theme === v || (v === 'auto' && s.theme === 'dark')) ? 'on' : ''}" data-act="theme-set" data-v="${v}">${l}</button>`).join('')}</div>
  <div class="seg-label">Exercise pictures</div>
  <div class="seg seg-theme">${[['fig', 'Animated'], ['ill', 'Illustrations'], ['photos', 'Photos']].map(([v, l]) => `<button class="${(s.visuals || 'fig') === v ? 'on' : ''}" data-act="visuals-set" data-v="${v}">${l}</button>`).join('')}</div>`;

  // Help
  html += `<div class="sec-h"><span>Help</span><small>Tap to open</small></div>`;
  html += helpCard('phone', 'teal', 'Install on your iPhone', 'Home screen, full screen, offline', `<ol class="plain">
      <li>Open the app's web address in <b>Safari</b> (not Chrome).</li>
      <li>Tap <b>Share</b>, then <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Open it from the home screen icon. It runs full screen and works offline.</li></ol>`);
  html += helpCard('shield', 'blue', 'Backing up and moving phones', 'Keep your logs safe', `<ol class="plain">
      <li><b>Back up now</b> above, then Save to Files in OneDrive or iCloud Drive.</li>
      <li>On a new phone or the laptop, open the app and tap <b>Restore</b>.</li></ol>`);
  html += helpCard('timer', 'violet', 'Guided sessions', 'How Start session works', `<p>On gym days tap <b>Start session</b>. The timer runs the warm-up, each set, changeovers, round rests, the finisher and cool-down, with a photo of every exercise. At each changeover a sheet shows the set you just did - adjust reps or kg if needed. At the end pick your effort and Save. Keep the screen open: the timer catches up if the phone locks.</p>`);
  html += helpCard('info', 'orange', 'Why these timings', 'The research behind the session', `<ul class="plain">
      <li><b>45 sec sets</b>: 10 - 15 controlled reps, about 40 - 60 sec of work per set.</li>
      <li><b>15 sec changeovers</b>: circuit studies show the best fat loss with 10 - 30 sec between exercises at moderate loads. Each muscle still gets about 8 min between its own sets.</li>
      <li><b>Rest between rounds 90 &gt; 75 &gt; 60 sec</b>: the muscle benefit of longer rest levels off around 90 sec, so rest shortens as your fitness builds.</li>
      <li><b>Effort 6 - 7 rising to 7 - 8</b>: getting closer to failure builds more muscle. Keep 1 - 3 good reps in the tank.</li>
      <li><b>Finishers 30 sec &gt; 1 min &gt; 2 min</b>: longer intervals improve fitness more. Short ones are the gentle start.</li>
      <li><b>5 min guided warm-up</b>: a little longer at 38, with calf work for the old strain.</li>
      <li><b>Time of day</b>: morning or evening gives the same long-term results. Pick a regular time.</li></ul>`);

  html += `<p class="muted center credit"><a href="https://repdb.co" target="_blank" rel="noopener">Exercise data by RepDB (repdb.co)</a><br>Exercise photos: Free Exercise DB (github.com/yuhonas/free-exercise-db), public domain.</p>`;
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
  speakParts(['Round', 'two', 'of', 'three', 'Next up', 'Goblet squat'], true);
});
// Play music in Spotify, then tap this: two cues a few seconds apart so you can hear the music dip and recover.
on('test-music', () => {
  unlockAudio();
  beepChange();
  setTimeout(() => speakParts(['Next up', 'Goblet squat'], true), 600);
  setTimeout(() => { beepShort(); }, 5000);
  setTimeout(() => speakParts(['Three'], true), 5100);
  setTimeout(() => speakParts(['Two'], true), 6100);
  setTimeout(() => speakParts(['One'], true), 7100);
  setTimeout(() => beepChange(), 8100);
  toast('Listen: the music should dip for each cue, then come back up');
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
    { key: 'settings.timing.roundRest', label: 'Rest between rounds (if a week has none)', type: 'num', half: true },
    { key: 'settings.timing.switchSec', label: 'Switch sides', type: 'num', half: true },
    { key: 'settings.timing.warmup', label: 'Warm-up (if no guided steps)', type: 'num', half: true },
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
      { key: 'roundRest', label: 'Rest between rounds (sec)', type: 'num', half: true },
      { key: 'effort', label: 'Effort target', type: 'text', half: true },
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
    return { title: 'Advanced', html: `<a class="round-btn back" href="#/settings" aria-label="Back to settings">&#8249;</a><div class="page-head"><div class="disp disp-lg">Advanced</div></div><form data-submit="ed-save" data-section="advanced">
      <p class="muted">The whole program and nutrition data. Only change this if you know what you're doing - export a backup first.</p>
      <textarea class="mono raw" name="raw" rows="24">${U.esc(JSON.stringify({ program: state.program, nutrition: state.nutrition }, null, 2))}</textarea>
      <div class="cta-dock"><button class="cta cta-block">Save</button></div></form>` };
  }
  const sec = SECTIONS[key];
  if (!sec) return { title: 'Edit', html: '<p>Unknown section.</p>' };
  let html = `<a class="round-btn back" href="#/settings" aria-label="Back to settings">&#8249;</a><div class="page-head"><div class="disp disp-lg">${U.esc(sec.title)}</div></div><form class="editor" data-submit="ed-save" data-section="${key}">`;
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
  html += `<div class="cta-dock"><button class="cta cta-block">Save changes</button></div></form>`;
  return { title: sec.title, html };
}
