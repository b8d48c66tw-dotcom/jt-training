// Plan: this week as a timeline of days with session cards, then the whole program as a grid.
import { state, peekDay } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { thumb, dayState, programGrid } from '../visual.js';
import { movePanel } from './today.js';

const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const IC = {
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  heart: svg('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
  moon: svg('<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.01"/>'),
};
const phaseCls = (name) => `ph-${String(name).toLowerCase().replace(/\s+/g, '')}`;

function statusPill(item, st, isToday) {
  if (st === 'done') return '<span class="pw-st good">&#10003; Done</span>';
  if (st === 'missed') return '<span class="pw-st bad">Missed</span>';
  if (st === 'skipped') return '<span class="pw-st warn">Skipped</span>';
  if (item.movedFrom) return `<span class="pw-st warn">From ${U.dayShort(item.movedFrom)}</span>`;
  if (isToday) return '<span class="pw-st today">Today</span>';
  return '';
}

function sessionCardRow(i, t) {
  const info = P.sessionInfo(i.key, i.week);
  const s = P.statusOf(i, t);
  const canMove = P.isCore(i.key) && s !== 'done' && !i.extra;
  const min = info.type === 'strength' ? P.guidedOptions(i.key, i.week, i.date).best.min : info.minutes;
  const meta = [min ? `${IC.clock}${min} min` : '', info.type === 'run' ? `${IC.heart}Under ${state.settings.hrCapHigh}` : ''].filter(Boolean);
  return `<div class="pw-card t-${info.type} ${s === 'done' ? 'is-done' : ''}">
      <a class="pw-main" href="#/session/${i.id}">${thumb(i, 'pw-th')}
        <div class="pw-m">${statusPill(i, s, i.date === t)}<div class="pw-t">${U.esc(info.title)}</div><div class="pw-s">${U.esc(info.subtitle)}</div>
          ${meta.length && s !== 'done' ? `<div class="pw-meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}</div></a>
      ${canMove ? `<button class="kebab" data-act="move-open" data-id="${i.id}" aria-label="Move or skip">&#8942;</button>` : ''}
    </div>${movePanel(i)}`;
}

export function renderWeek(nParam) {
  const total = P.weekCount();
  const n = Math.min(Math.max(Number(nParam) || P.currentWeek(), 1), total);
  const w = P.week(n);
  const t = U.today();
  const sum = P.weekSummary(n, t);
  const isCurrent = sum.days[0] <= t && t <= sum.days[6];
  const cur = P.currentWeek();

  // Hero: phase, dates and the 9-week journey (one segment per week, coloured by phase).
  let html = `<section class="pw-hero ${phaseCls(w.phase)}">
    <div class="pw-nav">
      ${n > 1 ? `<a class="pw-arrow" href="#/week/${n - 1}" aria-label="Previous week">&#8249;</a>` : '<span class="pw-arrow ghost"></span>'}
      <span class="pw-wk">Week ${n} of ${total}${isCurrent ? ' <b>This week</b>' : ''}</span>
      ${n < total ? `<a class="pw-arrow" href="#/week/${n + 1}" aria-label="Next week">&#8250;</a>` : '<span class="pw-arrow ghost"></span>'}
    </div>
    <div class="disp pw-phase">${U.esc(w.phase)}</div>
    <div class="pw-dates">${U.fmtDate(sum.days[0])} - ${U.fmtDate(sum.days[6])}</div>
    <div class="pw-journey">${Array.from({ length: total }, (_, k) => {
      const wk = P.week(k + 1);
      return `<a class="${phaseCls(wk.phase)}${k + 1 === n ? ' on' : ''}${cur && k + 1 < cur ? ' past' : ''}" href="#/week/${k + 1}" aria-label="Week ${k + 1}, ${U.esc(wk.phase)}"><i></i></a>`;
    }).join('')}</div>
  </section>`;

  // Week stats with small progress bars.
  const tile = (label, value, pct, cls) => `<div class="pw-stat ${cls}"><b>${value}</b><span>${label}</span><i><em style="width:${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%"></em></i></div>`;
  html += `<div class="pw-stats">
    ${tile('Sessions', `${sum.done}/${sum.planned}`, sum.planned ? sum.done / sum.planned : 0, 'c-teal')}
    ${tile('Km run', U.round1(sum.km), 0, 'c-blue no-bar')}
    ${tile('Mobility', `${sum.mobilityDays}/7`, sum.mobilityDays / 7, 'c-violet')}
    ${tile('Food', `${sum.nutritionPct}%`, sum.nutritionPct / 100, 'c-sky')}
  </div>`;

  // Days on a rail.
  html += '<ol class="pw-days">';
  for (const d of sum.days) {
    const items = P.itemsOn(d);
    const away = P.movedAway(d);
    const st = dayState(d, t);
    const dd = peekDay(d);
    let cards = items.map((i) => sessionCardRow(i, t)).join('');
    if (away) cards += `<div class="pw-rest">${IC.moon}<span><b>${U.esc(P.sessionInfo(away.key, away.week).title)} moved</b><small>Now on ${U.dayName(away.to)}</small></span></div>`;
    if (!items.length && !away) cards = `<a class="pw-rest" href="#/day/${d}">${IC.moon}<span><b>Rest day</b><small>Mobility and a walk</small></span></a>`;
    const habits = `${dd?.weight != null ? `<span>${dd.weight} kg</span>` : ''}${dd?.mobility ? '<span class="v">Mobility &#10003;</span>' : ''}${P.nutritionScore(d) ? `<span class="b">Food ${P.nutritionScore(d)}/5</span>` : ''}`;
    html += `<li class="pw-day st-${st}${d === t ? ' is-today' : ''}${d < t ? ' is-past' : ''}">
      <a class="pw-date" href="#/day/${d}"><small>${U.dayShort(d)}</small><b>${st === 'done' || st === 'cricket-done' ? '&#10003;' : U.parse(d).getDate()}</b></a>
      <div class="pw-cards">${cards}${habits ? `<div class="pd-habits pw-habits">${habits}</div>` : ''}</div>
    </li>`;
  }
  html += '</ol>';

  // Coaching notes and this week's finishers.
  if (w.notes) html += `<div class="sp-coach">${IC.info}<div><small>Week ${n} focus</small><p>${U.esc(w.notes)}</p></div></div>`;
  const fin = (key, label, which) => {
    const img = P.typeImg(key);
    return `<div class="pw-fin">${img ? `<img src="${P.imgSrc(img, 1)}" alt="" loading="lazy">` : ''}<span><small>${which} finisher</small><b>${U.esc(label)}</b></span></div>`;
  };
  html += `<div class="pw-kick">Finishers this week</div><div class="pw-fins">${fin('bike', w.finA.label, 'Strength A')}${fin('row', w.finB.label, 'Strength B')}</div>`;
  html += programGrid(n);
  html += `<a class="cta cta-ghost cta-block" href="#/checkin/${n}">Week ${n} check-in</a>`;
  return { title: 'Plan', html };
}
