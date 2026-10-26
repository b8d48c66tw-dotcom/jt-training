// Week view: Monday to Sunday with planned sessions, cricket, status and moves.
import { state, peekDay } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { card, pill, stat } from '../core.js';

export function renderWeek(nParam) {
  const n = Math.min(Math.max(Number(nParam) || P.currentWeek(), 1), P.weekCount());
  const w = P.week(n);
  const t = U.today();
  const sum = P.weekSummary(n, t);
  let html = `<div class="day-nav">
    ${n > 1 ? `<a class="btn btn-ghost" href="#/week/${n - 1}" aria-label="Previous week">&#9664;</a>` : '<span class="btn btn-ghost" aria-hidden="true"></span>'}
    <div class="day-title"><div class="h1">Week ${n}</div><div class="muted">${U.fmtDate(sum.days[0])} - ${U.fmtDate(sum.days[6])} - ${U.esc(w.phase)}</div></div>
    ${n < P.weekCount() ? `<a class="btn btn-ghost" href="#/week/${n + 1}" aria-label="Next week">&#9654;</a>` : '<span class="btn btn-ghost" aria-hidden="true"></span>'}
  </div>`;
  html += `<div class="stats">
    ${stat('Sessions', `${sum.done}/${sum.planned}`)}
    ${stat('Km run', U.round1(sum.km))}
    ${stat('Mobility', `${sum.mobilityDays}/7`)}
    ${stat('Nutrition', `${sum.nutritionPct}%`)}
  </div>`;
  if (w.notes) html += `<div class="note">${U.esc(w.notes)}</div>`;
  html += `<div class="note">Strength: ${w.rounds} rounds. Finishers: ${U.esc(w.finA.label)}; ${U.esc(w.finB.label)}.</div>`;

  for (const d of sum.days) {
    const items = P.itemsOn(d);
    const away = P.movedAway(d);
    const dd = peekDay(d);
    const marks = [
      dd?.weight != null ? `<span class="mark on">${dd.weight} kg</span>` : '',
      `<span class="mark ${dd?.mobility ? 'on' : ''}">Mob ${dd?.mobility ? '&#10003;' : '-'}</span>`,
      `<span class="mark ${P.nutritionScore(d) >= 4 ? 'on' : ''}">Food ${P.nutritionScore(d)}/5</span>`,
    ].join('');
    const rows = items.map((i) => {
      const info = P.sessionInfo(i.key, i.week);
      const st = P.statusOf(i, t);
      return `<a class="wk-item s-${info.type}" href="#/session/${i.id}">
        <div class="wk-item-top"><b>${U.esc(info.title)}</b>${pill(st)}</div>
        <div class="muted">${U.esc(info.subtitle)}${i.movedFrom ? ` (moved from ${U.dayShort(i.movedFrom)})` : ''}</div>
      </a>${P.isCore(i.key) && st === 'missed' ? `<a class="btn btn-sm" href="#/today">Move it</a>` : ''}`;
    }).join('');
    const awayRow = away ? `<div class="wk-item moved"><div class="wk-item-top"><b>${U.esc(P.sessionInfo(away.key, away.week).title)}</b>${pill('moved')}</div><div class="muted">Moved to ${U.dayName(away.to)}</div></div>` : '';
    html += card(`<a class="wk-day ${d === t ? 'is-today' : ''}" href="#/day/${d}"><span class="wk-dname">${U.dayName(d)}</span><span class="muted">${U.fmtDate(d)}</span></a>
      ${rows}${awayRow}${!items.length && !away ? '<div class="muted">Rest</div>' : ''}
      <div class="marks">${marks}</div>`, d === t ? 'card-today' : '');
  }
  html += `<a class="btn btn-primary btn-block" href="#/checkin/${n}">Week ${n} check-in</a>`;
  return { title: `Week ${n}`, html };
}
