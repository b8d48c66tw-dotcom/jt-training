// Today (or any single day): session, weigh-in, mobility, nutrition.
import { state, day, peekDay } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, card, pill, commit, toast, openTimer, rerender, rings } from '../core.js';

export function sessionCard(item, t) {
  const info = P.sessionInfo(item.key, item.week);
  const status = P.statusOf(item, t);
  const act = P.activityFor(item.id);
  let meta = info.minutes ? `${info.minutes} min` : '';
  if (act?.type === 'run' && act.distanceKm) meta = `${act.distanceKm} km in ${U.fmtDuration(act.durationSec)} - ${U.fmtPace(U.paceSec(act.distanceKm, act.durationSec))}`;
  const moved = item.movedFrom ? `<div class="note">Moved from ${U.dayName(item.movedFrom)} ${U.fmtDate(item.movedFrom)}</div>` : '';
  const canMove = P.isCore(item.key) && status !== 'done';
  const moveOpen = ui.moveOpen === item.id;
  let movePanel = '';
  if (moveOpen) {
    const free = P.freeDays(item);
    movePanel = `<div class="move-panel">
      ${free.length ? `<div class="lbl">Move to</div><div class="btn-row">${free.map((d) => `<button class="btn" data-act="move" data-id="${item.id}" data-to="${d}">${U.dayShort(d)} ${U.fmtDate(d)}</button>`).join('')}</div>` : '<div class="note">No free training days left this week.</div>'}
      <div class="btn-row">${item.movedFrom ? `<button class="btn btn-ghost" data-act="move" data-id="${item.id}" data-to="${item.origDate}">Back to ${U.dayShort(item.origDate)}</button>` : ''}<button class="btn btn-ghost" data-act="skip" data-id="${item.id}">Skip this week</button></div>
    </div>`;
  }
  const s = state.settings;
  const chips = [];
  if (info.minutes) chips.push(`${info.minutes} min`);
  if (info.type === 'run') chips.push(`HR &lt; ${s.hrCapHigh}`, { runwalk: 'Run/walk', easy: 'Easy', long: 'Long easy', tempo: 'Tempo' }[info.run.kind] || 'Easy');
  if (info.type === 'strength') chips.push(`${info.rounds} rounds`, 'Effort 6 - 7');
  const runReady = info.type === 'run' && status !== 'done';
  const primary = status === 'done'
    ? `<a class="btn btn-primary btn-lg" href="#/session/${item.id}">View log</a>`
    : runReady
      ? `<button class="btn btn-primary btn-lg" data-act="quick-timer" data-id="${item.id}">Start timer</button>`
      : `<a class="btn btn-primary btn-lg" href="#/session/${item.id}">${info.type === 'cricket' ? 'Log cricket' : 'Open session'}</a>`;
  return `<div class="hero s-${info.type}">
    <a class="session-main" href="#/session/${item.id}">
      <div class="hero-top"><span class="kicker teal">${item.date === U.today() ? "Today's session" : 'Session'}</span>${pill(status)}</div>
      <div class="hero-title">${U.esc(info.title)}</div>
      <div class="hero-sub">${U.esc(info.subtitle)}</div>
      ${meta && status === 'done' ? `<div class="session-meta">${U.esc(meta)}</div>` : ''}
      ${chips.length && status !== 'done' ? `<div class="chips-row">${chips.map((c) => `<span>${c}</span>`).join('')}</div>` : ''}
      ${moved}
    </a>
    ${primary}
    <div class="btn-row">
      ${runReady ? `<a class="btn" href="#/session/${item.id}">Details and log</a>` : ''}
      ${canMove ? `<button class="btn" data-act="move-open" data-id="${item.id}">${moveOpen ? 'Cancel' : 'Move'}</button>` : ''}
      ${status === 'skipped' ? `<button class="btn" data-act="unskip" data-id="${item.id}">Undo skip</button>` : ''}
    </div>
    ${movePanel}
  </div>`;
}

on('quick-timer', (el) => {
  const item = P.findItem(el.dataset.id);
  const info = P.sessionInfo(item.key, item.week);
  openTimer({ title: info.run.title, segments: info.run.segments, planId: item.id, onDoneHash: `#/session/${item.id}` });
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
  return card(`<h2>Morning weigh-in</h2>
    <form class="weigh" data-submit="weigh" data-date="${t}">
      <input class="big-input" name="weight" type="number" inputmode="decimal" step="0.1" min="40" max="200" placeholder="${w ?? (list.length ? list[list.length - 1].w : state.settings.startWeight)}" value="${w ?? ''}" aria-label="Weight in kg">
      <span class="unit">kg</span>
      <button class="btn btn-primary btn-lg">${w != null ? 'Update' : 'Save'}</button>
    </form>
    ${a7 != null ? `<div class="mini-stats"><span>${a7 <= target + 0.05 ? 'On or ahead of the target line' : `${U.round1(a7 - target)} kg above the target line`}</span></div>` : ''}`);
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
  return card(`<div class="card-head"><h2>Mobility - ${r.minutes} min${r.long ? ' (long flow)' : ''}</h2></div>
    <button class="tick ${done ? 'on' : ''}" data-act="toggle-mob" data-date="${t}"><span class="box">${done ? '&#10003;' : ''}</span>${done ? 'Mobility done' : 'Tick when done'}</button>
    <ul class="drills">${r.drills.map((m) => `<li><b>${U.esc(m.name)}</b> <span class="muted">${m.sides === 2 ? `${m.hold} sec each side` : `${m.hold} sec`}</span><div class="cue">${U.esc(m.cue)}</div></li>`).join('')}</ul>
    <button class="btn btn-lg btn-block" data-act="mob-timer" data-date="${t}">Start guided routine</button>`);
}
on('toggle-mob', (el) => { const d = day(el.dataset.date); d.mobility = !d.mobility; commit(); });
on('mob-timer', (el) => {
  const r = P.mobilityRoutine(el.dataset.date);
  openTimer({ title: `Mobility - ${r.minutes} min`, segments: P.mobilitySegments(r.drills) });
});

export function nutritionCard(t) {
  const d = peekDay(t) || { n: {} };
  const score = P.nutritionScore(t);
  const tg = state.settings.targets;
  return card(`<div class="card-head"><h2>Nutrition</h2><span class="score">${score}/${P.NUTRITION_ITEMS.length}</span></div>
    <div class="ticks">${P.NUTRITION_ITEMS.map((i) => `<button class="tick ${d.n?.[i.key] ? 'on' : ''}" data-act="toggle-n" data-date="${t}" data-key="${i.key}"><span class="box">${d.n?.[i.key] ? '&#10003;' : ''}</span>${U.esc(i.label)}</button>`).join('')}</div>
    <details class="more" ${d.kcal || d.proteinG ? 'open' : ''}><summary>Add calories and protein (optional)</summary>
      <div class="row2">
        <label class="field"><span class="lbl">Calories</span><input type="number" inputmode="numeric" data-change="n-num" data-date="${t}" data-key="kcal" value="${d.kcal ?? ''}" placeholder="${tg.kcal}"></label>
        <label class="field"><span class="lbl">Protein g</span><input type="number" inputmode="numeric" data-change="n-num" data-date="${t}" data-key="proteinG" value="${d.proteinG ?? ''}" placeholder="${tg.proteinLow}"></label>
      </div>
    </details>`);
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
  let html = `<div class="day-nav">
    <a class="btn" href="#/day/${U.addDays(t, -1)}" aria-label="Previous day">&#8249;</a>
    <div class="day-title"><div class="kicker">${n ? `Week ${n} - ${U.esc(P.week(n).phase)}` : 'Off program'}</div><div class="h1">${U.esc(U.fmtDateLong(t))}</div></div>
    <a class="btn" href="#/day/${U.addDays(t, 1)}" aria-label="Next day">&#8250;</a>
  </div>`;
  if (!isToday) html += `<a class="btn btn-block back-today" href="#/today">Back to today</a>`;

  // Activity rings: mobility (outer), food, week's sessions (inner). Days to go in the middle.
  html += `<div class="ring-wrap">${rings([
    { pct: d?.mobility ? 1 : 0, color: 'var(--accent)' },
    { pct: food / P.NUTRITION_ITEMS.length, color: 'var(--accent-2)' },
    { pct: sum && sum.planned ? sum.done / sum.planned : 0, color: 'var(--violet)' },
  ], daysLeft > 0 ? String(daysLeft) : daysLeft === 0 ? 'Today' : '-', daysLeft > 0 ? `days to ${U.fmtDate(s.goalDate)}` : 'goal day')}</div>
  <div class="ring-legend"><span><i style="background:var(--accent)"></i>Mobility</span><span><i style="background:var(--accent-2)"></i>Food ${food}/5</span><span><i style="background:var(--violet)"></i>Week ${sum ? `${sum.done}/${sum.planned}` : '-'}</span></div>`;
  if (isToday) html += backupBanner() + missedBanner(t);

  let sessions = items.map((i) => sessionCard(i, U.today())).join('');
  if (away) sessions += `<div class="note">${U.esc(P.sessionInfo(away.key, away.week).title)} moved to ${U.dayName(away.to)} ${U.fmtDate(away.to)}</div>`;
  if (!items.length && !away) sessions = card(n ? '<div class="kicker">Session</div><div class="hero-title">Rest day</div><p class="muted">Mobility and a walk if you feel like it.</p>' : `<p class="muted">Outside the 9-week program (${U.fmtDate(s.startDate)} - ${U.fmtDate(s.endDate)}).</p>`);
  if (n && P.week(n).notes && U.dow(t) === 1) sessions += `<div class="note">${U.esc(P.week(n).notes)}</div>`;
  html += sessions;

  // Weight and goal tiles
  const list = P.weights();
  const a7 = P.avg7(t, list) ?? (list.length ? list[list.length - 1].w : null);
  html += `<div class="tiles">
    <div class="tile"><div class="kicker">Weight</div><div class="tile-v">${a7 != null ? U.round1(a7).toFixed(1) : '-'}</div><div class="muted">7-day avg - target ${U.round1(P.targetAt(t)).toFixed(1)}</div></div>
    <div class="tile"><div class="kicker">Goal</div><div class="tile-v">${s.goalWeight.toFixed(1)}</div><div class="muted">${a7 != null ? `${Math.max(0, U.round1(a7 - s.goalWeight)).toFixed(1)} kg to go` : `by ${U.fmtDate(s.goalDate)}`}</div></div>
  </div>`;

  html += weighCard(t);
  html += mobilityCard(t);
  html += nutritionCard(t);
  if (n && (U.dow(t) === 0 || U.dow(t) === 6)) {
    html += card(`<h2>Weekly check-in</h2><p>Review week ${n}: weight trend, sessions, km and nutrition.</p><a class="btn btn-primary btn-block" href="#/checkin/${n}">Open week ${n} check-in</a>`);
  }
  html += card(`<h2>Bigger goal</h2><p>${U.esc(s.longTermGoal)}.</p>`, 'card-quiet');
  return { title: isToday ? 'Today' : U.fmtDate(t), html };
}
