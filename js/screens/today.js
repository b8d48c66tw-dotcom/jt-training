// Today (or any single day): session, weigh-in, mobility, nutrition.
import { state, day, peekDay } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, card, commit, toast, openTimer, rerender, rings } from '../core.js';
import { heroBg, weekStrip } from '../visual.js';

// Primary button for a session: guided start, run timer, log cricket or view the log.
export function primaryAction(item, status, cls = 'cta') {
  const info = P.sessionInfo(item.key, item.week);
  if (status === 'done') return `<a class="${cls} cta-ghost" href="#/session/${item.id}">View log</a>`;
  if (info.type === 'run') return `<button class="${cls}" data-act="quick-timer" data-id="${item.id}">Start run</button>`;
  if (info.type === 'strength') {
    const o = P.guidedOptions(item.key, item.week, item.date).best;
    return `<button class="${cls}" data-act="guided" data-key="${item.key}" data-n="${item.week}" data-date="${item.date}" data-r="${o.rounds}" data-c="${o.compress ? 1 : ''}" data-id="${item.id}" data-hash="#/session/${item.id}">Start session</button>`;
  }
  return `<a class="${cls}" href="#/session/${item.id}">${info.type === 'cricket' ? 'Log cricket' : 'Open'}</a>`;
}

export function sessionChips(item) {
  const info = P.sessionInfo(item.key, item.week);
  const s = state.settings;
  const out = [];
  if (info.type === 'strength') {
    const o = P.guidedOptions(item.key, item.week, item.date).best;
    out.push(`${o.min} min`, `${o.rounds} rounds`);
  } else if (info.minutes) out.push(`${info.minutes} min`);
  if (info.type === 'run') out.push(`HR &lt; ${s.hrCapHigh}`);
  return out;
}

export function movePanel(item) {
  if (ui.moveOpen !== item.id) return '';
  const free = P.freeDays(item);
  return `<div class="card move-panel">
    ${free.length ? `<div class="lbl">Move to</div><div class="btn-row">${free.map((d) => `<button class="btn" data-act="move" data-id="${item.id}" data-to="${d}">${U.dayShort(d)} ${U.fmtDate(d)}</button>`).join('')}</div>` : '<div class="note">No free training days left this week.</div>'}
    <div class="btn-row">${item.movedFrom ? `<button class="btn btn-ghost" data-act="move" data-id="${item.id}" data-to="${item.origDate}">Back to ${U.dayShort(item.origDate)}</button>` : ''}<button class="btn btn-ghost" data-act="skip" data-id="${item.id}">Skip this week</button><button class="btn btn-ghost" data-act="move-open" data-id="${item.id}">Cancel</button></div>
  </div>`;
}

export function sessionCard(item, t) {
  const info = P.sessionInfo(item.key, item.week);
  const status = P.statusOf(item, t);
  const act = P.activityFor(item.id);
  const canMove = P.isCore(item.key) && status !== 'done' && !item.extra;
  let sub = info.subtitle;
  if (act?.type === 'run' && act.distanceKm) sub = `${act.distanceKm} km in ${U.fmtDuration(act.durationSec)} - ${U.fmtPace(U.paceSec(act.distanceKm, act.durationSec))}`;
  const statusChip = status === 'done' ? '<span class="tag tag-good">&#10003; Complete</span>'
    : status === 'missed' ? '<span class="tag tag-bad">Missed</span>'
      : status === 'skipped' ? '<span class="tag tag-warn">Skipped</span>'
        : item.extra ? '<span class="tag tag-t">Trial</span>'
          : item.date === U.today() ? '<span class="tag tag-t">Today</span>' : '';
  // Icon stats: length, rounds or exercises, heart rate cap.
  const meta = [];
  if (status !== 'done') {
    if (info.type === 'strength') {
      const o = P.guidedOptions(item.key, item.week, item.date).best;
      meta.push(['clock', `${o.min} min`], ['rounds', `${o.rounds} rounds`], ['list', `${info.def.exercises.length} exercises`]);
    } else if (info.minutes) meta.push(['clock', `${info.minutes} min`]);
    if (info.type === 'run') meta.push(['heart', `HR under ${state.settings.hrCapHigh}`]);
  }
  return `<div class="hero2 td-hero s-${info.type}">
    ${heroBg(item)}<div class="hb-shade"></div>
    <div class="hero2-in">
      <div class="tags">${statusChip}${item.movedFrom ? `<span class="tag">From ${U.dayShort(item.movedFrom)}</span>` : ''}</div>
      <a class="disp hero2-title" href="#/session/${item.id}">${U.esc(info.title)}</a>
      <div class="hero2-sub">${U.esc(sub)}</div>
      ${meta.length ? `<div class="td-meta">${meta.map(([ic, t]) => `<span>${TI[ic]}${t}</span>`).join('')}</div>` : ''}
      ${item.extra?.note ? `<div class="hero2-note">${U.esc(item.extra.note)}</div>` : ''}
      ${primaryAction(item, status)}
      <div class="hero2-links"><a href="#/session/${item.id}">Details</a>${canMove ? `<button data-act="move-open" data-id="${item.id}">Move</button>` : ''}${status === 'skipped' ? `<button data-act="unskip" data-id="${item.id}">Undo skip</button>` : ''}</div>
    </div>
  </div>${movePanel(item)}`;
}

// Small line icons for the Today page.
const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const TI = {
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  rounds: svg('<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  heart: svg('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M8 5.5v13l11-6.5z"/></svg>',
  scale: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 9a5 5 0 0 1 7 0l-2 2.5h-3z"/>'),
  food: svg('<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1-3 4-3 7h3"/>'),
  stretch: svg('<circle cx="12" cy="4.5" r="2"/><path d="M5 9l7 1 7-1M12 10v5l-4 6M12 15l4 6"/>'),
  shake: svg('<path d="M7 7h10l-1.3 13a1 1 0 0 1-1 .9H9.3a1 1 0 0 1-1-.9z"/><path d="M6 7h12M10 7l1-4h3"/>'),
  protein: svg('<path d="M6.5 6.5l11 11"/><path d="M4 9l5-5 2 2-5 5zM13 18l5-5 2 2-5 5z"/>'),
  water: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  veg: svg('<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19l8-8"/>'),
  steps: svg('<path d="M7 14c-1.5 0-2.5-1.5-2.5-4S5.5 4 7.5 4 10 6 10 8.5 9 14 7 14zM5.5 17h3.5v1.5a1.8 1.8 0 0 1-3.5 0zM17 18c-2 0-3-5.5-3-8s1-4.5 2.5-4.5 3 2.5 3 5-1 7.5-2.5 7.5zM14.5 20.5h3.5"/>'),
};
const restIcon = () => '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 8a16 16 0 1 0 10 26A14 14 0 0 1 30 8z"/></svg>';
on('jump', (el) => document.getElementById(el.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
on('quick-timer', (el) => {
  const item = P.findItem(el.dataset.id);
  const info = P.sessionInfo(item.key, item.week);
  openTimer({ title: info.run.title, segments: info.run.segments, planId: item.id, onDoneHash: `#/session/${item.id}`, photo: 'run' });
});

on('move-open', (el) => { ui.moveOpen = ui.moveOpen === el.dataset.id ? null : el.dataset.id; rerender(); });
on('move', (el) => {
  P.moveItem(el.dataset.id, el.dataset.to);
  ui.moveOpen = null;
  toast(`Moved to ${U.dayName(el.dataset.to)}`);
  commit();
});
on('skip', (el) => { state.skips[el.dataset.id] = true; ui.moveOpen = null; commit(); });
on('unskip', (el) => { delete state.skips[el.dataset.id]; commit(); });

function backupBanner() {
  const last = state.meta.lastBackup;
  const hasData = Object.keys(state.days).length > 0 || state.activities.some((a) => a.source !== 'strava');
  if (!hasData) return '';
  const age = last ? U.diffDays(last.slice(0, 10), U.today()) : null;
  if (age != null && age < 7) return '';
  return `<a class="banner banner-warn" href="#/settings">${last ? `Last backup ${age} days ago.` : 'No backup yet.'} Tap to back up now.</a>`;
}

function missedBanner(t) {
  const missed = P.missedThisWeek(t);
  if (!missed.length) return '';
  return card(`<h2>Missed this week</h2>${missed.map((i) => {
    const info = P.sessionInfo(i.key, i.week);
    const free = P.freeDays(i, t);
    return `<div class="missed">
      <div><b>${U.esc(info.title)}</b> - ${U.dayName(i.date)} ${U.fmtDate(i.date)}</div>
      <div class="btn-row">
        ${free.length ? `<button class="btn btn-primary" data-act="move" data-id="${i.id}" data-to="${free[0]}">Move to ${U.dayShort(free[0])} ${U.fmtDate(free[0])}</button>` : '<span class="note">No free day left this week</span>'}
        ${free.length > 1 ? `<button class="btn" data-act="move-open" data-id="${i.id}">Other day</button>` : ''}
        <button class="btn btn-ghost" data-act="skip" data-id="${i.id}">Skip</button>
      </div>
      ${ui.moveOpen === i.id ? `<div class="btn-row">${free.slice(1).map((d) => `<button class="btn" data-act="move" data-id="${i.id}" data-to="${d}">${U.dayShort(d)} ${U.fmtDate(d)}</button>`).join('')}</div>` : ''}
    </div>`;
  }).join('')}`, 'card-warn');
}

function weighCard(t) {
  const d = peekDay(t);
  const w = d?.weight;
  const list = P.weights();
  const a7 = P.avg7(t, list);
  const target = P.targetAt(t);
  const onTrack = a7 != null && a7 <= target + 0.05;
  return card(`<div class="td-ch" id="c-weigh"><span class="td-ic ic-w">${TI.scale}</span><h2>Morning weigh-in</h2>${a7 != null ? `<span class="td-avg"><b>${U.round1(a7).toFixed(1)}</b> 7-day avg</span>` : ''}</div>
    <form class="weigh" data-submit="weigh" data-date="${t}">
      <input class="big-input" name="weight" type="number" inputmode="decimal" step="0.1" min="40" max="200" placeholder="${w ?? (list.length ? list[list.length - 1].w : state.settings.startWeight)}" value="${w ?? ''}" aria-label="Weight in kg">
      <span class="unit">kg</span>
      <button class="btn btn-primary btn-lg">${w != null ? 'Update' : 'Save'}</button>
    </form>
    ${spark(list.filter((p) => p.date <= t).slice(-14))}
    ${a7 != null ? `<div class="td-trend ${onTrack ? 'good' : 'warn'}">${onTrack ? 'On or ahead of the target line' : `${U.round1(a7 - target)} kg above the target line`}</div>` : ''}`, 'td-card');
}
// Last two weeks of weigh-ins as a small line with the goal weight underneath.
function spark(pts) {
  if (pts.length < 2) return '';
  const s = state.settings;
  const ws = pts.map((p) => p.w);
  const mid = (Math.min(...ws) + Math.max(...ws)) / 2, half = Math.max(0.8, (Math.max(...ws) - Math.min(...ws)) / 2 + 0.2);
  const lo = mid - half, hi = mid + half;
  const W = 300, H = 64;
  const x = (i) => (i / (pts.length - 1)) * (W - 8) + 4;
  const y = (v) => H - 6 - ((v - lo) / (hi - lo)) * (H - 12);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.w).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<div class="td-spark"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Weight over the last ${pts.length} weigh-ins">
    ${s.goalWeight >= lo ? `<line x1="0" x2="${W}" y1="${y(s.goalWeight).toFixed(1)}" y2="${y(s.goalWeight).toFixed(1)}" class="gl"/>` : ''}
    <path d="${line} L${x(pts.length - 1).toFixed(1)} ${H} L4 ${H}z" class="ar"/><path d="${line}" class="ln"/>
    <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last.w).toFixed(1)}" r="4" class="pt"/></svg>
    <div class="td-spark-k"><span>${U.fmtDate(pts[0].date)}</span><span>${U.round1(last.w - pts[0].w) <= 0 ? '' : '+'}${U.round1(last.w - pts[0].w)} kg</span><span>Goal ${s.goalWeight} kg</span></div></div>`;
}
on('weigh', (form) => {
  const w = U.num(form.weight.value);
  if (w == null || w < 40 || w > 200) return toast('Enter a weight in kg');
  day(form.dataset.date).weight = U.round1(w);
  toast('Weight saved');
  commit();
});

function mobilityCard(t) {
  const d = peekDay(t);
  const done = !!d?.mobility;
  const r = P.mobilityRoutine(t);
  return card(`<div class="td-ch" id="c-mob"><span class="td-ic ic-m">${TI.stretch}</span><h2>Mobility</h2><span class="td-pill">${r.minutes} min${r.long ? ' - long flow' : ''}</span>
      <button class="td-done ${done ? 'on' : ''}" data-act="toggle-mob" data-date="${t}" aria-label="${done ? 'Mark mobility not done' : 'Mark mobility done'}">${done ? '&#10003;' : ''}</button></div>
    <div class="td-drills">${r.drills.map((m, i) => {
      const key = P.imgFor(m.name);
      return `<div class="td-drill">${key ? `<img src="${P.imgSrc(key, 1)}" alt="" loading="lazy">` : '<div class="td-noimg"></div>'}<span class="td-n">${i + 1}</span><b>${U.esc(m.name)}</b><small>${m.sides === 2 ? `${m.hold} sec each side` : `${m.hold} sec`}</small></div>`;
    }).join('')}</div>
    <button class="btn btn-primary btn-lg btn-block td-go" data-act="mob-timer" data-date="${t}">${TI.play}${done ? 'Do it again' : 'Start guided routine'}</button>`, 'td-card');
}
on('toggle-mob', (el) => { const d = day(el.dataset.date); d.mobility = !d.mobility; commit(); });
on('mob-timer', (el) => {
  const r = P.mobilityRoutine(el.dataset.date);
  openTimer({ title: `Mobility - ${r.minutes} min`, segments: P.mobilitySegments(r.drills), meta: { mobilityDate: el.dataset.date } });
});

export function nutritionCard(t) {
  const d = peekDay(t) || { n: {} };
  const score = P.nutritionScore(t);
  const tg = state.settings.targets;
  return card(`<div class="td-ch" id="c-food"><span class="td-ic ic-f">${TI.food}</span><h2>Nutrition</h2><span class="score">${score}/${P.NUTRITION_ITEMS.length}</span></div>
    <div class="td-seg">${P.NUTRITION_ITEMS.map((_, k) => `<i class="${k < score ? 'on' : ''}"></i>`).join('')}</div>
    <div class="td-ticks">${P.NUTRITION_ITEMS.map((i) => `<button class="td-tick ${d.n?.[i.key] ? 'on' : ''}" data-act="toggle-n" data-date="${t}" data-key="${i.key}" aria-pressed="${!!d.n?.[i.key]}"><span class="td-ti">${TI[i.key] || TI.food}</span><span class="td-tl">${U.esc(i.label)}</span><span class="td-box">${d.n?.[i.key] ? '&#10003;' : ''}</span></button>`).join('')}</div>
    <details class="more" ${d.kcal || d.proteinG ? 'open' : ''}><summary>Add calories and protein (optional)</summary>
      <div class="row2">
        <label class="field"><span class="lbl">Calories</span><input type="number" inputmode="numeric" data-change="n-num" data-date="${t}" data-key="kcal" value="${d.kcal ?? ''}" placeholder="${tg.kcal}"></label>
        <label class="field"><span class="lbl">Protein g</span><input type="number" inputmode="numeric" data-change="n-num" data-date="${t}" data-key="proteinG" value="${d.proteinG ?? ''}" placeholder="${tg.proteinLow}"></label>
      </div>
    </details>`, 'td-card');
}
on('toggle-n', (el) => { const d = day(el.dataset.date); d.n = d.n || {}; d.n[el.dataset.key] = !d.n[el.dataset.key]; commit(); });
on('n-num', (el) => { day(el.dataset.date)[el.dataset.key] = U.num(el.value); commit(); });

export function renderToday(dateParam) {
  const t = dateParam || U.today();
  const isToday = t === U.today();
  const n = P.weekNum(t);
  const s = state.settings;
  const daysLeft = U.diffDays(U.today(), s.goalDate);
  const items = P.itemsOn(t);
  const away = P.movedAway(t);
  const d = peekDay(t);
  const sum = n ? P.weekSummary(n) : null;
  const food = P.nutritionScore(t);
  const phase = n ? `Week ${n} - ${P.week(n).phase}` : t < s.startDate ? `Starts ${U.dayName(s.startDate)} ${U.fmtDate(s.startDate)}` : 'Program finished';
  // Goal countdown ring: share of the time from program start to the goal date already behind you.
  const span = Math.max(1, U.diffDays(s.startDate, s.goalDate));
  const gone = Math.max(0, Math.min(1, U.diffDays(s.startDate, U.today()) / span));
  const hr = new Date().getHours();
  const hello = !isToday ? '' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  let html = `<div class="today-head td-head">
    <div><div class="kick">${hello ? `${hello} <i></i> ` : ''}${U.esc(phase)}</div><div class="today-date">${U.esc(U.fmtDateLong(t))}</div></div>
    <div class="td-goal" title="${daysLeft > 0 ? daysLeft : 0} days to ${U.fmtDate(s.goalDate)}">
      <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" class="rt"/><circle cx="32" cy="32" r="27" class="rp" pathLength="100" style="stroke-dashoffset:${(100 - gone * 100).toFixed(1)}${gone ? '' : ';opacity:0'}"/></svg>
      <span><b>${daysLeft > 0 ? daysLeft : 0}</b><small>days to ${U.fmtDate(s.goalDate)}</small></span>
    </div>
  </div>`;
  html += weekStrip(t);
  if (!isToday) html += `<a class="btn btn-block back-today" href="#/today">Back to today</a>`;
  if (isToday) html += backupBanner() + missedBanner(t);

  let sessions = items.map((i) => sessionCard(i, U.today())).join('');
  if (away) sessions += `<div class="note">${U.esc(P.sessionInfo(away.key, away.week).title)} moved to ${U.dayName(away.to)} ${U.fmtDate(away.to)}</div>`;
  if (!items.length && !away) {
    sessions = `<div class="hero2 hero2-rest"><div class="hb-graphic g-rest">${restIcon()}</div><div class="hb-shade"></div><div class="hero2-in">
      <div class="disp hero2-title">${n ? 'Rest day' : t < s.startDate ? 'Get ready' : 'Done'}</div>
      <div class="hero2-sub">${n ? 'Mobility and a walk if you feel like it.' : t < s.startDate ? `Week 1 starts ${U.dayName(s.startDate)} ${U.fmtDate(s.startDate)}. Practise the weigh-in, mobility and food ticks.` : `The program finished on ${U.fmtDate(s.endDate)}.`}</div>
    </div></div>`;
  }
  if (n && P.week(n).notes && t === P.weekStart(n)) sessions += `<div class="note">${U.esc(P.week(n).notes)}</div>`;
  html += sessions;

  // Habit tiles: tap to jump to the full card below.
  const list = P.weights();
  const a7 = P.avg7(t, list) ?? (list.length ? list[list.length - 1].w : null);
  const lost = a7 != null ? s.startWeight - a7 : 0;
  const wPct = Math.max(0, Math.min(100, (lost / (s.startWeight - s.goalWeight)) * 100));
  const mob = P.mobilityRoutine(t);
  // Daily rings: weigh-in, food ticks and mobility, with a legend that jumps to each card.
  const nFood = P.NUTRITION_ITEMS.length;
  const closed = (d?.weight != null ? 1 : 0) + (food === nFood ? 1 : 0) + (d?.mobility ? 1 : 0);
  const leg = (to, cls, ic, name, val, sub) => `<button class="td-leg ${cls}" data-act="jump" data-to="${to}"><span class="td-ic">${TI[ic]}</span><span><small>${name}</small><b>${val}</b></span><em>${sub}</em></button>`;
  html += `<section class="card td-card td-rings">
    <div class="td-rw">${rings([
      { pct: d?.weight != null ? 1 : 0, color: '#5eead4' },
      { pct: food / nFood, color: '#38bdf8' },
      { pct: d?.mobility ? 1 : 0, color: '#a78bfa' },
    ], `${closed}/3`, '', 132)}</div>
    <div class="td-legs">
      ${leg('c-weigh', 'ic-w', 'scale', 'Weigh-in', d?.weight != null ? `${d.weight} kg` : 'Not yet', a7 != null ? `${Math.round(wPct)}% to goal` : '')}
      ${leg('c-food', 'ic-f', 'food', 'Nutrition', `${food} of ${nFood}`, food === nFood ? 'All ticked' : `${nFood - food} to go`)}
      ${leg('c-mob', 'ic-m', 'stretch', 'Mobility', d?.mobility ? 'Done' : `${mob.minutes} min`, d?.mobility ? '&#10003;' : 'Guided')}
    </div>
  </section>`;

  html += weighCard(t);
  html += mobilityCard(t);
  html += nutritionCard(t);
  if (n && U.diffDays(t, P.weekDays(n)[6]) <= 1) {
    html += card(`<h2>Weekly check-in</h2><p>Review week ${n}: weight trend, sessions, km and nutrition.</p><a class="btn btn-primary btn-block" href="#/checkin/${n}">Open week ${n} check-in</a>`);
  }
  html += `<div class="td-big"><small>The bigger goal</small><p>${U.esc(s.longTermGoal)}.</p></div>`;
  return { title: isToday ? 'Today' : U.fmtDate(t), html };
}
