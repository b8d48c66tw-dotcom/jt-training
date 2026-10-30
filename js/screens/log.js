// Log: this week at a glance, quick add, and a timeline of everything logged.
import { state } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, rerender } from '../core.js';
import { activityThumb, graphic } from '../visual.js';

const FILTERS = [['all', 'All'], ['run', 'Runs'], ['strength', 'Strength'], ['cricket', 'Cricket'], ['cardio', 'Cardio'], ['days', 'Daily']];
const WORKOUT = ['run', 'strength', 'cardio', 'other'];

// Big-number metrics for a timeline card.
function metrics(a) {
  const m = (v, l) => `<span><b>${v}</b><small>${l}</small></span>`;
  switch (a.type) {
    case 'run': return m(a.distanceKm, 'km') + m(U.fmtDuration(a.durationSec), 'time') + m(U.fmtPace(U.paceSec(a.distanceKm, a.durationSec)).replace('/km', ''), '/km');
    case 'strength': {
      const ex = (a.exercises || []).filter((e) => e.reps?.some((r) => r != null)).length;
      const reps = (a.exercises || []).reduce((s, e) => s + (e.unit === 'sec' || e.unit === 'secEach' ? 0 : (e.reps || []).reduce((x, r) => x + (r || 0), 0) * (e.unit === 'each' ? 2 : 1)), 0);
      return m(a.rounds || 0, 'rounds') + m(ex, 'moves') + (reps ? m(reps, 'reps') : '') + (a.effort ? m(a.effort, 'effort') : '');
    }
    case 'cricket': return (a.durationSec ? m(U.round1(a.durationSec / 3600), 'hours') : '') + (a.effort ? m(a.effort, 'effort') : '') + m(a.cricketKind === 'game' ? 'Game' : 'Training', 'type');
    default: return (a.durationSec ? m(Math.round(a.durationSec / 60), 'min') : '') + (a.distanceM ? m(a.distanceM, 'm') : '') + (a.felt ? m(a.felt, 'effort') : '');
  }
}

function weekGlance() {
  const mon = U.mondayOf(U.today());
  const sun = U.addDays(mon, 6);
  const acts = state.activities.filter((a) => a.date >= mon && a.date <= sun);
  const sessions = acts.filter((a) => WORKOUT.includes(a.type)).length;
  const km = acts.filter((a) => a.type === 'run').reduce((s, a) => s + (a.distanceKm || 0), 0);
  const min = acts.reduce((s, a) => s + (a.durationSec || 0), 0) / 60;
  const total = state.activities.filter((a) => WORKOUT.includes(a.type) && a.date.startsWith(String(new Date().getFullYear()))).length;
  return `<div class="page-head"><div class="disp disp-lg">Log</div><div class="muted">${total} workouts logged this year</div></div>
    <div class="glance">
      <div><span class="kick">This week</span><b>${sessions}</b><small>sessions</small></div>
      <div><span class="kick">Run</span><b>${U.round1(km)}</b><small>km</small></div>
      <div><span class="kick">Active</span><b>${Math.round(min)}</b><small>minutes</small></div>
    </div>`;
}

function quickAdd() {
  const photo = (key) => {
    const img = P.imgFor(P.exerciseById(state.program.strength[key]?.exercises?.[0])?.name);
    return img ? `<img class="qa-pic" src="img/ex/${img}-1.jpg" alt="">` : graphic('strength', 'qa-pic');
  };
  const tile = (href, pic, label) => `<a class="qa" href="${href}">${pic}<span>${label}</span></a>`;
  return `<div class="sec-h"><span>Add a log</span><small>Quick add</small></div>
    <div class="qa-row">
      ${tile('#/new/run', graphic('run', 'qa-pic'), 'Run')}
      ${tile('#/new/strengthA', photo('strengthA'), 'Strength A')}
      ${tile('#/new/strengthB', photo('strengthB'), 'Strength B')}
      ${tile('#/new/cricket', graphic('cricket', 'qa-pic'), 'Cricket')}
      ${tile('#/new/cardio', graphic('floating', 'qa-pic'), 'Cardio')}
      ${tile('#/new/other', graphic('rest', 'qa-pic'), 'Other')}
    </div>`;
}

on('log-filter', (el) => { ui.logFilter = el.dataset.f; rerender(false); });

export function renderLog() {
  const f = ui.logFilter || 'all';
  let html = weekGlance() + quickAdd();
  html += `<div class="seg">${FILTERS.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="log-filter" data-f="${k}">${l}</button>`).join('')}</div>`;

  if (f === 'days') {
    const days = Object.entries(state.days).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    if (!days.length) return { title: 'Log', html: html + '<div class="empty">No daily entries yet. Weigh-ins, mobility and food ticks will show here.</div>' };
    html += days.map(([d, x]) => {
      const food = P.nutritionScore(d);
      return `<a class="day-card" href="#/day/${d}">
        <div class="dc-date"><b>${U.parse(d).getDate()}</b><span>${U.dayShort(d)}</span></div>
        <div class="dc-w">${x.weight != null ? `<b>${x.weight}</b><small>kg</small>` : '<span class="muted">No weigh-in</span>'}</div>
        <div class="dc-tags"><span class="${x.mobility ? 'ok' : ''}">Mobility ${x.mobility ? '&#10003;' : '-'}</span><span class="${food >= 4 ? 'ok' : ''}">Food ${food}/5</span>${x.kcal ? `<span>${x.kcal} kcal</span>` : ''}</div>
      </a>`;
    }).join('');
    return { title: 'Log', html };
  }

  const list = state.activities.filter((a) => f === 'all' || a.type === f).sort((a, b) => (a.date === b.date ? (a.created < b.created ? 1 : -1) : a.date < b.date ? 1 : -1));
  if (!list.length) return { title: 'Log', html: html + '<div class="empty">Nothing logged yet.</div>' };
  let month = '';
  for (const a of list) {
    const m = a.date.slice(0, 7);
    if (m !== month) {
      month = m;
      const inMonth = list.filter((x) => x.date.startsWith(m));
      const km = inMonth.filter((x) => x.type === 'run').reduce((s, x) => s + (x.distanceKm || 0), 0);
      html += `<div class="month-h"><span class="disp">${U.parse(`${m}-01`).toLocaleString('en-AU', { month: 'long' })}</span><small>${m.slice(0, 4)} - ${inMonth.length} logged${km ? ` - ${U.round1(km)} km` : ''}</small></div>`;
    }
    html += `<a class="lg t-${a.type}" href="#/activity/${a.id}">
      ${activityThumb(a, 'lg-pic')}
      <div class="lg-m">
        <div class="lg-top"><span class="kick">${U.dayShort(a.date)} ${U.fmtDate(a.date)}</span>${a.source === 'strava' ? '<span class="src">Strava</span>' : ''}</div>
        <div class="lg-t">${U.esc(a.title)}</div>
        <div class="lg-nums">${metrics(a)}</div>
      </div>
    </a>`;
  }
  return { title: 'Log', html };
}
