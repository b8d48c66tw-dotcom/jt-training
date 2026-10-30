// Plan: this week as a list of days with session cards, then the whole program as a grid.
import { peekDay } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { stat } from '../core.js';
import { thumb, restThumb, dayState, programGrid } from '../visual.js';
import { movePanel } from './today.js';

function statusLine(item, st, info) {
  if (st === 'done') return '<span class="st st-good">&#10003; Complete</span>';
  if (st === 'missed') return '<span class="st st-bad">Missed</span>';
  if (st === 'skipped') return '<span class="st st-warn">Skipped</span>';
  if (item.movedFrom) return `<span class="st st-warn">Moved from ${U.dayShort(item.movedFrom)}</span>`;
  if (st === 'today') return '<span class="st st-good">Today</span>';
  const min = info.type === 'strength' ? P.guidedOptions(item.key, item.week, item.date).best.min : info.minutes;
  return min ? `<span class="st">${min} min</span>` : '';
}

export function renderWeek(nParam) {
  const n = Math.min(Math.max(Number(nParam) || P.currentWeek(), 1), P.weekCount());
  const w = P.week(n);
  const t = U.today();
  const sum = P.weekSummary(n, t);
  const isCurrent = sum.days[0] <= t && t <= sum.days[6];
  let html = `<div class="plan-head">
    ${n > 1 ? `<a class="round-btn" href="#/week/${n - 1}" aria-label="Previous week">&#8249;</a>` : '<span class="round-btn ghost"></span>'}
    <div class="plan-title"><div class="disp disp-lg">${isCurrent ? 'This week' : `Week ${n}`}</div><div class="teal">${U.fmtDate(sum.days[0])} - ${U.fmtDate(sum.days[6])} - ${U.esc(w.phase)}</div></div>
    ${n < P.weekCount() ? `<a class="round-btn" href="#/week/${n + 1}" aria-label="Next week">&#8250;</a>` : '<span class="round-btn ghost"></span>'}
  </div>`;
  html += `<div class="stats">
    ${stat('Sessions', `${sum.done}/${sum.planned}`)}
    ${stat('Km run', U.round1(sum.km))}
    ${stat('Mobility', `${sum.mobilityDays}/7`)}
    ${stat('Food', `${sum.nutritionPct}%`)}
  </div>`;

  for (const d of sum.days) {
    const items = P.itemsOn(d);
    const away = P.movedAway(d);
    const st = dayState(d, t);
    const mark = st === 'done' || st === 'cricket-done' ? '&#10003;' : U.parse(d).getDate();
    const dd = peekDay(d);
    let cards = items.map((i) => {
      const info = P.sessionInfo(i.key, i.week);
      const s = P.statusOf(i, t);
      const canMove = P.isCore(i.key) && s !== 'done' && !i.extra;
      return `<div class="pc s-${info.type} ${s === 'done' ? 'is-done' : ''}">
        <a class="pc-main" href="#/session/${i.id}">${thumb(i)}<div class="pc-m">${statusLine(i, s, info)}<div class="pc-t">${U.esc(info.title)}</div><div class="pc-s">${U.esc(info.subtitle)}</div></div></a>
        ${canMove ? `<button class="kebab" data-act="move-open" data-id="${i.id}" aria-label="Move or skip">&#8942;</button>` : ''}
      </div>${movePanel(i)}`;
    }).join('');
    if (away) cards += `<div class="pc pc-dashed"><div class="pc-main">${restThumb()}<div class="pc-m"><span class="st st-warn">Moved</span><div class="pc-t">${U.esc(P.sessionInfo(away.key, away.week).title)}</div><div class="pc-s">Now on ${U.dayName(away.to)}</div></div></div></div>`;
    if (!items.length && !away) cards = `<div class="pc pc-dashed"><a class="pc-main" href="#/day/${d}">${restThumb()}<div class="pc-m"><div class="pc-t muted">Rest day</div><div class="pc-s">Mobility and a walk</div></div></a></div>`;
    const habits = `${dd?.weight != null ? `<span>${dd.weight} kg</span>` : ''}${dd?.mobility ? '<span>Mobility &#10003;</span>' : ''}${P.nutritionScore(d) ? `<span>Food ${P.nutritionScore(d)}/5</span>` : ''}`;
    html += `<div class="plan-day ${d === t ? 'is-today' : ''}">
      <a class="pd-left" href="#/day/${d}"><span class="pd-dn">${U.dayShort(d)}</span><span class="dot st-${st} ${d === t ? 'is-today' : ''}">${mark}</span></a>
      <div class="pd-cards">${cards}${habits ? `<div class="pd-habits">${habits}</div>` : ''}</div>
    </div>`;
  }
  if (w.notes) html += `<div class="note">${U.esc(w.notes)}</div>`;
  html += `<div class="note">Finishers: ${U.esc(w.finA.label)}; ${U.esc(w.finB.label)}.</div>`;
  html += programGrid(n);
  html += `<a class="cta cta-ghost cta-block" href="#/checkin/${n}">Week ${n} check-in</a>`;
  return { title: 'Plan', html };
}
