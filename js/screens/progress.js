// Progress charts and the weekly check-in.
import { state, saveState } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, card, stat, rerender, rings } from '../core.js';
import { weekStreak, graphic, pic, pageHero } from '../visual.js';
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
  return card(`${chHead('weight', 'Bodyweight')}${chart}${legend([['dot-s1', 'Daily weigh-in'], ['ln-s1', '7-day average'], ['ln-muted dash', `Target ${U.round1(((s.startWeight - s.goalWeight) / U.diffDays(s.startDate, s.goalDate)) * 7)} kg/wk`], ['ln-s1 dash', 'Projection']])}${msg}`);
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
  return card(`<div class="td-ch pg-ch"><span class="td-ic">${CH.km}</span><h2>Weekly km</h2><div class="chips sm">
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
  return card(`${chHead('pace', 'Run pace')}<p class="muted">Faster is higher. Easy includes run/walk and long runs.</p>${chart}${legend([['dot-s1', 'Easy runs'], ['dot-s2', 'Tempo and intervals']])}`);
}

on('str-ex', (el) => { ui.strEx = el.value; rerender(); });
function strengthSection() {
  const names = new Set();
  for (const a of state.activities) if (a.type === 'strength') for (const e of a.exercises || []) if (e.reps?.length) names.add(e.name);
  if (!names.size) return card(`${chHead('str', 'Strength progression')}<p class="muted">Log a strength session to see progress per exercise.</p>`);
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
  return card(`${chHead('str', 'Strength progression')}
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

function goalHero() {
  const s = state.settings;
  const list = P.weights();
  const last = list[list.length - 1];
  const avg = last ? P.avg7(last.date, list) : null;
  const lost = avg != null ? Math.max(0, s.startWeight - avg) : 0;
  const need = s.startWeight - s.goalWeight;
  const pct = Math.min(1, lost / need);
  const proj = P.projection(list);
  const daysLeft = Math.max(0, U.diffDays(U.today(), s.goalDate));
  const cw = P.currentWeek();
  return pageHero({
    kick: `Week ${cw} of ${P.weekCount()} - ${U.esc(P.week(cw).phase)}`, title: 'Progress', cls: 'pg-prog',
    sub: avg != null ? `${U.round1(lost).toFixed(1)} kg down - ${U.round1(Math.max(0, avg - s.goalWeight)).toFixed(1)} to go` : `${s.startWeight} kg to ${s.goalWeight} kg by ${U.fmtDate(s.goalDate)}`,
    side: `<div class="pg-ring">${rings([{ pct, color: '#5eead4' }], `${Math.round(pct * 100)}%`, '', 104)}<small>of goal</small></div>`,
    stats: [[avg != null ? U.round1(avg).toFixed(1) : '-', '7-day avg kg'], [daysLeft, 'days left'], [proj ? U.round1(proj.value).toFixed(1) : '-', `kg on ${U.fmtDate(s.goalDate)}`]],
  });
}

const sv = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const STK = {
  teal: sv('<path d="M5 12.5 10 17l9-10"/>'),
  orange: sv('<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 .5 2 1.5 3 3 3 0-3-1-5 0-8z"/>'),
  blue: sv('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 9a5 5 0 0 1 7 0l-2 2.5h-3z"/>'),
  violet: sv('<circle cx="12" cy="4.5" r="2"/><path d="M5 9l7 1 7-1M12 10v5l-4 6M12 15l4 6"/>'),
};
const CH = {
  weight: sv('<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  km: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  pace: sv('<circle cx="12" cy="13" r="8"/><path d="M12 13l4-3M10 2h4"/>'),
  str: sv('<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>'),
};
const chHead = (ic, title, right = '') => `<div class="td-ch pg-ch"><span class="td-ic">${CH[ic]}</span><h2>${title}</h2>${right}</div>`;
function streakTiles() {
  const st = P.streaks();
  const t = U.today();
  let done = 0, due = 0;
  for (let n = 1; n <= P.weekCount(); n++) {
    for (const d of P.weekDays(n)) {
      if (d > t) break;
      for (const i of P.itemsOn(d)) {
        if (!P.isCore(i.key)) continue;
        const stt = P.statusOf(i, t);
        if (stt === 'done') { done++; due++; } else if (d < t && stt !== 'skipped') due++;
      }
    }
  }
  const tile = (v, l, sub, tone) => `<div class="stk-tile t-${tone}"><span class="stk-ic">${STK[tone]}</span><b>${v}</b><span>${l}</span><small>${sub}</small></div>`;
  return `<div class="stk-grid">
    ${tile(`${done}/${due}`, 'Sessions', 'done so far', 'teal')}
    ${tile(weekStreak(), 'Week streak', 'weeks training', 'orange')}
    ${tile(st.weighIn, 'Weigh-ins', 'days in a row', 'blue')}
    ${tile(st.mobility, 'Mobility', 'days in a row', 'violet')}
  </div>`;
}

function journalPreview() {
  const names = new Map();
  for (const a of state.activities) if (a.type === 'strength') for (const e of a.exercises || []) if (e.reps?.some((r) => r != null)) names.set(e.name, true);
  const pics = [...names.keys()].map((n) => P.imgFor(n)).filter(Boolean).slice(0, 4);
  return `<a class="jr-card" href="#/journal">
    <div class="jr-pics">${pics.length ? pics.map((k) => pic(k)).join('') : '<span class="muted">Your lifts will appear here</span>'}</div>
    <div class="jr-foot"><span><b class="disp">Movement journal</b><small>${names.size} movements - best weights and history</small></span><span class="chev">&#8250;</span></div>
  </a>`;
}

export function renderProgress() {
  const s = state.settings;
  const cw = P.currentWeek();
  let html = goalHero() + streakTiles() + journalPreview();
  html += `<div class="prog-page">${weightSection()}${kmSection()}${paceSection()}${strengthSection()}</div>`;
  html += `<div class="sec-h"><span>Weekly check-ins</span><small>Review each week</small></div>
    <div class="ci-row">${Array.from({ length: P.weekCount() }, (_, i) => {
      const n = i + 1;
      const future = n > cw;
      const hasNotes = !!state.checkins[n]?.notes;
      return future ? `<span class="ci ci-future ${'ph-' + P.week(n).phase.toLowerCase().replace(/\s+/g, '')}"><b>W${n}</b><small>${U.esc(P.week(n).phase)}</small></span>`
        : `<a class="ci ${n === cw ? 'ci-now' : ''} ${'ph-' + P.week(n).phase.toLowerCase().replace(/\s+/g, '')}" href="#/checkin/${n}"><b>W${n}</b><small>${hasNotes ? '&#10003; Notes' : n === cw ? 'This week' : 'Review'}</small></a>`;
    }).join('')}</div>`;
  const runImg = P.typeImg('run');
  html += `<div class="hero2 hero2-goal">${runImg ? `<div class="hb-photo${P.isStudio(runImg) ? ' hb-studio' : ''}" style="background-image:url('${P.imgSrc(runImg, 1)}')"></div>` : graphic('run', 'hb-graphic')}<div class="hb-shade"></div><div class="hero2-in">
      <div class="kick">The bigger goal</div>
      <div class="disp hero2-title">Half marathon<br>sub 6:00/km</div>
      <div class="hero2-sub">${U.esc(s.longTermGoal)}. Baseline: Newcastle Half, 19 Apr 2026 - 2:37:50 (7:23/km) with walk breaks. Sub-6:00/km is about 2:06:36.</div>
    </div></div>`;
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
  const w = P.week(n);
  const total = P.weekCount();
  const ph = `ph-${w.phase.toLowerCase().replace(/\s+/g, '')}`;
  let html = `<section class="pw-hero ${ph}">
    <div class="pw-nav">
      ${n > 1 ? `<a class="pw-arrow" href="#/checkin/${n - 1}" aria-label="Previous week">&#8249;</a>` : '<span class="pw-arrow ghost"></span>'}
      <span class="pw-wk">Week ${n} check-in</span>
      ${n < total ? `<a class="pw-arrow" href="#/checkin/${n + 1}" aria-label="Next week">&#8250;</a>` : '<span class="pw-arrow ghost"></span>'}
    </div>
    <div class="disp pw-phase">${s.avg != null ? `${U.round1(s.avg).toFixed(1)}<small> kg</small>` : U.esc(w.phase)}</div>
    <div class="pw-dates">${s.avg != null ? `7-day average - ${U.esc(w.phase)}, ` : ''}${U.fmtDate(s.days[0])} - ${U.fmtDate(s.days[6])}</div>
    <div class="ci-wts">
      <div><b>${s.change != null ? `${s.change > 0 ? '+' : ''}${U.round1(s.change).toFixed(1)}` : '-'}</b><span>${n === 1 ? 'vs start' : 'vs last week'}</span></div>
      <div><b>${U.round1(P.targetAt(s.days[6])).toFixed(1)}</b><span>target by Sun</span></div>
    </div>
  </section>`;
  const tile = (label, value, pct, cls) => `<div class="pw-stat ${cls}"><b>${value}</b><span>${label}</span><i><em style="width:${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%"></em></i></div>`;
  html += `<div class="pw-stats">
    ${tile('Sessions', `${s.done}/${s.planned}`, s.planned ? s.done / s.planned : 0, 'c-teal')}
    ${tile('Km run', U.round1(s.km).toFixed(1), 0, 'c-blue no-bar')}
    ${tile('Mobility', `${s.mobilityDays}/7`, s.mobilityDays / 7, 'c-violet')}
    ${tile('Food', `${s.nutritionPct}%`, s.nutritionPct / 100, 'c-sky')}
  </div>`;
  const CI = { good: '<path d="M5 12.5 10 17l9-10"/>', warn: '<path d="M12 4 3 20h18z"/><path d="M12 10v4M12 17v.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>' };
  html += `<div class="pw-kick">Coaching</div>${msgs.map((m) => `<div class="ci-coach t-${m.tone}"><svg viewBox="0 0 24 24" aria-hidden="true">${CI[m.tone] || CI.info}</svg><p>${U.esc(m.text)}</p></div>`).join('')}`;
  html += `<div class="pw-kick">Your notes</div>` + card(`<textarea rows="5" data-input="checkin-notes" data-n="${n}" placeholder="How did the week go? Energy, sleep, hunger, niggles, wins.">${U.esc(state.checkins[n]?.notes || '')}</textarea><p class="muted small">Saves as you type.</p>`, 'td-card');
  const ok = backupAge != null && backupAge < 7;
  html += `<div class="ci-backup ${ok ? 'ok' : 'warn'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/>${ok ? '<path d="m8.5 12 2.5 2.5 4.5-5"/>' : '<path d="M12 8v4.5M12 15.5v.01"/>'}</svg>
    <span><b>${last ? `Last backup ${backupAge === 0 ? 'today' : `${backupAge} day${backupAge === 1 ? '' : 's'} ago`}` : 'No backup yet'}</b><small>Back up every Sunday.</small></span>
    <button class="btn btn-primary" data-act="export-json">Back up</button></div>`;
  return { title: `Week ${n} check-in`, html };
}

// ---- movement journal --------------------------------------------------------------------------------
function movementNames() {
  const names = new Map();
  for (const a of state.activities) {
    if (a.type !== 'strength') continue;
    for (const e of a.exercises || []) if (e.reps?.some((r) => r != null)) names.set(e.name, (names.get(e.name) || 0) + 1);
  }
  return [...names.keys()];
}

export function renderJournal(nameParam) {
  if (nameParam) {
    const name = decodeURIComponent(nameParam);
    const h = P.exerciseHistory(name);
    const img = P.imgFor(name);
    const best = Math.max(0, ...h.map((x) => x.weight || 0));
    const pts = h.map((x) => ({ x: U.diffDays(state.settings.startDate, x.date), y: x.weight || x.reps.reduce((a, b) => a + b, 0), tip: `${U.fmtDate(x.date)}: ${x.weight ? `${x.weight} kg x ` : ''}${x.reps.join(', ')}` }));
    let html = `<a class="round-btn back" href="#/journal" aria-label="Back to journal">&#8249;</a>`;
    html += `<div class="jr-hero">${pic(img)}<div class="hb-shade"></div><div class="jr-in"><div class="kick">Movement</div><div class="disp jr-title">${U.esc(name)}</div><div class="teal">${best ? `Best: ${best} kg` : 'Bodyweight'} - ${h.length} session${h.length === 1 ? '' : 's'}</div></div></div>`;
    html += card(`<h2>${h.some((x) => x.weight) ? 'Weight over time' : 'Reps over time'}</h2>${lineChart({ series: [{ name, cls: 's1', dots: true, points: pts }], yFmt: (v) => v, label: `${name} history` })}`);
    html += h.slice().reverse().map((x) => `<div class="row-link"><div class="row-top"><b>${U.fmtDateLong(x.date)}</b><span class="muted">${x.effort ? `Effort ${x.effort}` : ''}</span></div><div class="muted">${x.weight ? `${x.weight} kg - ` : ''}${x.reps.join(', ')}</div></div>`).join('');
    return { title: name, html };
  }
  const names = movementNames();
  let html = `<div class="disp disp-lg">Journal</div><p class="muted">Every movement you have logged, with your best weight. Tap one to see its history.</p>`;
  if (!names.length) return { title: 'Journal', html: html + card('<p class="muted">Finish a strength session and your movements will appear here.</p>') };
  html += names.map((n) => {
    const h = P.exerciseHistory(n);
    const best = Math.max(0, ...h.map((x) => x.weight || 0));
    const img = P.imgFor(n);
    const last = h[h.length - 1];
    return `<a class="jr-row" href="#/journal/${encodeURIComponent(n)}">${pic(img, '', 0) || '<div class="li-th"></div>'}<div class="jr-m"><b>${U.esc(n)}</b><span>${best ? `Best: ${best} kg` : `Last: ${last.reps.join(', ')}`}</span></div><span class="chev">&#8250;</span></a>`;
  }).join('');
  return { title: 'Journal', html };
}
