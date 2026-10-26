// Log: quick-add buttons, activity history and daily entries.
import { state } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, card, rerender } from '../core.js';

const FILTERS = [['all', 'All'], ['run', 'Runs'], ['strength', 'Strength'], ['cricket', 'Cricket'], ['cardio', 'Cardio'], ['days', 'Daily entries']];

function summary(a) {
  switch (a.type) {
    case 'run': return `${a.distanceKm} km - ${U.fmtDuration(a.durationSec)} - ${U.fmtPace(U.paceSec(a.distanceKm, a.durationSec))}${a.avgHr ? ` - ${a.avgHr} bpm` : ''}`;
    case 'strength': {
      const ex = (a.exercises || []).filter((e) => e.reps?.length).length;
      return `${ex} exercises - ${a.rounds || 0} rounds${a.effort ? ` - effort ${a.effort}` : ''}`;
    }
    case 'cricket': return `${a.durationSec ? `${U.round1(a.durationSec / 3600)} h` : ''}${a.effort ? ` - effort ${a.effort}` : ''}`;
    default: return a.durationSec ? `${Math.round(a.durationSec / 60)} min` : '';
  }
}

on('log-filter', (el) => { ui.logFilter = el.dataset.f; rerender(false); });

export function renderLog() {
  const f = ui.logFilter || 'all';
  let html = card(`<h2>Add a log</h2><div class="add-grid">
    <a class="btn" href="#/new/run">Run</a>
    <a class="btn" href="#/new/strengthA">Strength A</a>
    <a class="btn" href="#/new/strengthB">Strength B</a>
    <a class="btn" href="#/new/cardio">Cardio</a>
    <a class="btn" href="#/new/cricket">Cricket</a>
    <a class="btn" href="#/new/other">Other</a>
  </div><p class="muted">Planned sessions are best logged from Today or Week so they count as done.</p>`);
  html += `<div class="chips">${FILTERS.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="log-filter" data-f="${k}">${l}</button>`).join('')}</div>`;

  if (f === 'days') {
    const days = Object.entries(state.days).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    if (!days.length) return { title: 'Log', html: html + '<p class="muted">No daily entries yet.</p>' };
    html += days.map(([d, x]) => `<a class="row-link" href="#/day/${d}">
      <div><b>${U.dayShort(d)} ${U.fmtDate(d)}</b></div>
      <div class="muted">${x.weight != null ? `${x.weight} kg - ` : ''}Mobility ${x.mobility ? '&#10003;' : '-'} - Food ${P.nutritionScore(d)}/5${x.kcal ? ` - ${x.kcal} kcal` : ''}${x.proteinG ? ` - ${x.proteinG} g protein` : ''}</div>
    </a>`).join('');
    return { title: 'Log', html };
  }

  const list = state.activities.filter((a) => f === 'all' || a.type === f).sort((a, b) => (a.date === b.date ? (a.created < b.created ? 1 : -1) : a.date < b.date ? 1 : -1));
  if (!list.length) return { title: 'Log', html: html + '<p class="muted">Nothing logged yet.</p>' };
  let month = '';
  for (const a of list) {
    const m = a.date.slice(0, 7);
    if (m !== month) {
      month = m;
      const d = U.parse(a.date + '');
      html += `<h3 class="month">${d.toLocaleString('en-AU', { month: 'long', year: 'numeric' })}</h3>`;
    }
    html += `<a class="row-link t-${a.type}" href="#/activity/${a.id}">
      <div class="row-top"><b>${U.esc(a.title)}</b><span class="muted">${U.dayShort(a.date)} ${U.fmtDate(a.date)}</span></div>
      <div class="muted">${U.esc(summary(a))}${a.source === 'strava' ? ' - Strava' : ''}</div>
    </a>`;
  }
  return { title: 'Log', html };
}
