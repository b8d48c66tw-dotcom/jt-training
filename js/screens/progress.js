// Progress charts and the weekly check-in.
import { state, saveState } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, card, stat, rerender } from '../core.js';
import { lineChart, barChart } from '../charts.js';

const legend = (items) => `<div class="legend">${items.map(([cls, label]) => `<span><i class="sw ${cls}"></i>${U.esc(label)}</span>`).join('')}</div>`;

function weightSection() {
  const s = state.settings;
  const list = P.weights();
  const xOf = (d) => U.diffDays(s.startDate, d);
  const goalX = xOf(s.goalDate);
  const endX = xOf(s.endDate);
  const proj = P.projection(list);
  const last = list[list.length - 1];
  const curAvg = last ? P.avg7(last.date, list) : null;

  const tiles = `<div class="stats">
    ${stat('7-day avg', curAvg != null ? U.round1(curAvg).toFixed(1) : '-', 'kg')}
    ${stat('Since start', curAvg != null ? `${curAvg - s.startWeight <= 0 ? '' : '+'}${U.round1(curAvg - s.startWeight).toFixed(1)}` : '-', 'kg')}
    ${stat('To go', curAvg != null ? Math.max(0, U.round1(curAvg - s.goalWeight)).toFixed(1) : (s.startWeight - s.goalWeight).toFixed(1), 'kg')}
    ${stat(`Projected ${U.fmtDate(s.goalDate)}`, proj ? U.round1(proj.value).toFixed(1) : '-', proj ? `${U.round1(proj.slopePerWeek)} kg/wk` : 'needs 3+ weigh-ins')}
  </div>`;

  const series = [
    { name: 'Target', cls: 'muted', dash: true, points: [
      { x: 0, y: s.startWeight, tip: `Start ${U.fmtDate(s.startDate)}: ${s.startWeight} kg` },
      { x: goalX, y: s.goalWeight, tip: `Target ${U.fmtDate(s.goalDate)}: ${s.goalWeight} kg` },
    ] },
    { name: 'Daily', cls: 's1 light', line: false, dots: true, r: 4, points: list.map((p) => ({ x: xOf(p.date), y: p.w, tip: `${U.fmtDate(p.date)}: ${p.w} kg (avg ${U.round1(P.avg7(p.date, list)).toFixed(1)}, target ${U.round1(P.targetAt(p.date)).toFixed(1)})` })) },
    { name: '7-day avg', cls: 's1', width: 3, points: list.map((p) => ({ x: xOf(p.date), y: P.avg7(p.date, list) })) },
  ];
  if (proj && last) {
    series.push({ name: 'Projection', cls: 's1', dash: true, points: [
      { x: proj.lastX, y: proj.at(proj.lastX) },
      { x: goalX, y: proj.value, tip: `Projected ${U.fmtDate(s.goalDate)}: ${U.round1(proj.value).toFixed(1)} kg` },
    ] });
  }
  const xMin = Math.min(0, ...list.map((p) => xOf(p.date)));
  const xLabels = [];
  for (let x = 0; x <= endX; x += 21) xLabels.push({ x, label: U.fmtDate(U.addDays(s.startDate, x)) });
  const chart = lineChart({
    series, xMin, xMax: endX, yFmt: (v) => v, xLabels, hoverSeries: [1, 0, 3].filter((i) => series[i]),
    label: 'Bodyweight with 7-day average, target line and projection',
  });
  let msg = '';
  if (proj) {
    const diff = proj.value - s.goalWeight;
    msg = `<p class="${diff <= 0.3 ? 'good' : 'warn-text'}">${diff <= 0.3 ? 'On track for' : `Trending ${U.round1(diff)} kg above`} ${s.goalWeight} kg on ${U.fmtDate(s.goalDate)}.</p>`;
  }
  return card(`<h2>Bodyweight</h2>${tiles}${chart}${legend([['dot-s1', 'Daily weigh-in'], ['ln-s1', '7-day average'], ['ln-muted dash', 'Target 0.7 kg/wk'], ['ln-s1 dash', 'Projection']])}${msg}`);
}

on('km-range', (el) => { ui.kmRange = el.dataset.r; rerender(); });
function kmSection() {
  const range = ui.kmRange || 'program';
  let bars = [];
  if (range === 'program') {
    for (let n = 1; n <= P.weekCount(); n++) {
      const d = P.weekDays(n);
      const km = P.kmBetween(d[0], d[6]);
      bars.push({ label: `W${n}`, value: U.round1(km), tip: `Week ${n} (${U.fmtDate(d[0])}): ${U.round1(km)} km` });
    }
  } else {
    const end = U.mondayOf(U.today() < state.settings.endDate ? U.today() : state.settings.endDate);
    for (let m = U.mondayOf('2026-01-01'); m <= end; m = U.addDays(m, 7)) {
      const km = P.kmBetween(m, U.addDays(m, 6));
      bars.push({ label: U.fmtDate(m), value: U.round1(km), tip: `Week of ${U.fmtDate(m)}: ${U.round1(km)} km` });
    }
  }
  return card(`<div class="card-head"><h2>Weekly km</h2><div class="chips sm">
      <button class="chip ${range === 'program' ? 'on' : ''}" data-act="km-range" data-r="program">Program</button>
      <button class="chip ${range === 'year' ? 'on' : ''}" data-act="km-range" data-r="year">2026</button></div></div>
    ${barChart({ bars, yFmt: (v) => v, label: 'Kilometres run per week' })}`);
}

function paceSection() {
  const all = P.runs().filter((r) => r.durationSec);
  const x0 = '2026-01-01';
  const pt = (r) => ({ x: U.diffDays(x0, r.date), y: U.paceSec(r.distanceKm, r.durationSec), tip: `${U.fmtDate(r.date)}: ${r.distanceKm} km at ${U.fmtPace(U.paceSec(r.distanceKm, r.durationSec))}${r.avgHr ? `, ${r.avgHr} bpm` : ''}` });
  const easy = all.filter((r) => ['easy', 'long', 'runwalk'].includes(r.runKind)).map(pt);
  const tempo = all.filter((r) => r.runKind === 'tempo').map(pt);
  const xLabels = [];
  for (let m = 0; m < 12; m++) {
    const d = `2026-${U.pad(m + 1)}-01`;
    if (m % 3 === 0) xLabels.push({ x: U.diffDays(x0, d), label: U.fmtDate(d).split(' ')[1] });
  }
  const chart = lineChart({
    series: [
      { name: 'Easy', cls: 's1', dots: true, points: easy },
      { name: 'Tempo', cls: 's2', dots: true, points: tempo },
    ],
    xMin: 0, xMax: U.diffDays(x0, '2026-12-31'), invertY: true, yFmt: (v) => U.fmtPace(v).replace('/km', ''), xLabels,
    label: 'Average pace per run, easy and tempo, faster is higher', empty: 'No runs yet',
  });
  return card(`<h2>Run pace</h2><p class="muted">Faster is higher. Easy includes run/walk and long runs.</p>${chart}${legend([['dot-s1', 'Easy runs'], ['dot-s2', 'Tempo and intervals']])}`);
}

on('str-ex', (el) => { ui.strEx = el.value; rerender(); });
function strengthSection() {
  const names = new Set();
  for (const a of state.activities) if (a.type === 'strength') for (const e of a.exercises || []) if (e.reps?.length) names.add(e.name);
  if (!names.size) return card('<h2>Strength progression</h2><p class="muted">Log a strength session to see progress per exercise.</p>');
  const list = [...names];
  const pick = list.includes(ui.strEx) ? ui.strEx : list[0];
  const h = P.exerciseHistory(pick);
  const useWeight = h.some((x) => x.weight);
  const pts = h.map((x) => ({
    x: U.diffDays(state.settings.startDate, x.date),
    y: useWeight ? x.weight : x.reps.reduce((a, b) => a + b, 0),
    tip: `${U.fmtDate(x.date)}: ${x.weight ? `${x.weight} kg x ` : ''}${x.reps.join(', ')}`,
  }));
  const chart = lineChart({ series: [{ name: pick, cls: 's1', dots: true, points: pts }], yFmt: (v) => v, label: `${pick} progression`, xLabels: pts.length ? [{ x: pts[0].x, label: U.fmtDate(h[0].date) }, { x: pts[pts.length - 1].x, label: U.fmtDate(h[h.length - 1].date) }] : [] });
  const rows = list.map((name) => {
    const hh = P.exerciseHistory(name);
    const l = hh[hh.length - 1];
    const ex = state.program.exercises.find((e) => e.name === name || e.laterName === name || (e.swaps || []).includes(name));
    const ready = ex ? P.readyToGoUp(ex, name) : null;
    return `<li><b>${U.esc(name)}</b><div class="muted">${l.weight ? `${l.weight} kg x ` : ''}${l.reps.join(', ')} (${U.fmtDate(l.date)})</div>${ready ? `<div class="badge-up">&#9650; ${U.esc(ready.suggestion)}</div>` : ''}</li>`;
  }).join('');
  return card(`<h2>Strength progression</h2>
    <label class="field"><span class="lbl">Exercise</span><select data-change="str-ex">${list.map((n) => `<option ${n === pick ? 'selected' : ''}>${U.esc(n)}</option>`).join('')}</select></label>
    <p class="muted">${useWeight ? 'Weight (kg) per session' : 'Total reps or seconds per session'}</p>${chart}
    <h3>Latest per exercise</h3><ul class="plain-list">${rows}</ul>`);
}

function adherenceSection() {
  const st = P.streaks();
  const t = U.today();
  let done = 0, due = 0;
  for (let n = 1; n <= P.weekCount(); n++) {
    for (const d of P.weekDays(n)) {
      if (d > t) break;
      for (const i of P.itemsOn(d)) {
        if (!P.isCore(i.key)) continue;
        const st = P.statusOf(i, t);
        if (st === 'done') { done++; due++; } else if (d < t && st !== 'skipped') due++;
      }
    }
  }
  return card(`<h2>Adherence</h2><div class="stats">
    ${stat('Sessions done', `${done}/${due}`, 'so far')}
    ${stat('Mobility', st.mobility, 'day streak')}
    ${stat('Weigh-ins', st.weighIn, 'day streak')}
    ${stat('Nutrition 4+/5', st.nutrition, 'day streak')}
  </div>`);
}

export function renderProgress() {
  const s = state.settings;
  const daysLeft = U.diffDays(U.today(), s.goalDate);
  const cw = P.currentWeek();
  let html = `<div class="countdown">${daysLeft > 0 ? `<b>${daysLeft}</b> days to ${U.fmtDate(s.goalDate)}` : 'Goal date reached'} - ${s.startWeight} kg to ${s.goalWeight} kg</div>`;
  html += weightSection() + kmSection() + paceSection() + strengthSection() + adherenceSection();
  html += card(`<h2>Weekly check-ins</h2><div class="add-grid">${Array.from({ length: cw }, (_, i) => `<a class="btn" href="#/checkin/${i + 1}">Week ${i + 1}</a>`).join('')}</div>`);
  html += card(`<h2>Longer-term goal</h2><p>${U.esc(s.longTermGoal)}.</p>
    <p class="muted">Baseline: Newcastle Half, 19 Apr 2026 - 21.4 km in 2:37:50 (7:23/km) with walk breaks. Sub-6:00/km means about 2:06:36 or faster.</p>`, 'card-quiet');
  return { title: 'Progress', html };
}

// ---- weekly check-in ------------------------------------------------------------------------
on('checkin-notes', (el) => {
  const n = el.dataset.n;
  state.checkins[n] = { ...(state.checkins[n] || {}), notes: el.value, updated: new Date().toISOString() };
  saveState();
});

export function renderCheckin(nParam) {
  const n = Math.min(Math.max(Number(nParam) || P.currentWeek(), 1), P.weekCount());
  const s = P.weekSummary(n);
  const msgs = P.coaching(n);
  const last = state.meta.lastBackup;
  const backupAge = last ? U.diffDays(last.slice(0, 10), U.today()) : null;
  let html = `<div class="day-nav">
    ${n > 1 ? `<a class="btn btn-ghost" href="#/checkin/${n - 1}" aria-label="Previous week">&#9664;</a>` : '<span class="btn btn-ghost" aria-hidden="true"></span>'}
    <div class="day-title"><div class="h1">Week ${n} check-in</div><div class="muted">${U.fmtDate(s.days[0])} - ${U.fmtDate(s.days[6])} - ${U.esc(P.week(n).phase)}</div></div>
    ${n < P.weekCount() ? `<a class="btn btn-ghost" href="#/checkin/${n + 1}" aria-label="Next week">&#9654;</a>` : '<span class="btn btn-ghost" aria-hidden="true"></span>'}
  </div>`;
  html += `<div class="stats stats-3">
    ${stat('7-day avg', s.avg != null ? U.round1(s.avg).toFixed(1) : '-', 'kg')}
    ${stat(n === 1 ? 'vs start' : 'vs last week', s.change != null ? `${s.change > 0 ? '+' : ''}${U.round1(s.change).toFixed(1)}` : '-', 'kg')}
    ${stat('Target', U.round1(P.targetAt(s.days[6])).toFixed(1), 'kg by Sunday')}
    ${stat('Sessions', `${s.done}/${s.planned}`, 'done')}
    ${stat('Km run', U.round1(s.km).toFixed(1), 'km')}
    ${stat('Mobility', `${s.mobilityDays}/7`, 'days')}
    ${stat('Nutrition', `${s.nutritionPct}%`, 'adherence')}
  </div>`;
  html += card(`<h2>Coaching</h2>${msgs.map((m) => `<div class="coach coach-${m.tone}">${U.esc(m.text)}</div>`).join('')}`);
  html += card(`<h2>Notes</h2><textarea rows="5" data-input="checkin-notes" data-n="${n}" placeholder="How did the week go? Energy, sleep, hunger, niggles, wins.">${U.esc(state.checkins[n]?.notes || '')}</textarea><p class="muted">Saves as you type.</p>`);
  html += card(`<h2>Backup</h2><p>${last ? `Last backup ${backupAge === 0 ? 'today' : `${backupAge} days ago`}.` : 'No backup yet.'} Back up every Sunday.</p><button class="btn btn-primary btn-block" data-act="export-json">Back up now</button>`, backupAge == null || backupAge >= 7 ? 'card-warn' : '');
  return { title: `Week ${n} check-in`, html };
}
