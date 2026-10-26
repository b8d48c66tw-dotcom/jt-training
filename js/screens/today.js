// Today (or any single day): session, weigh-in, mobility, nutrition.
import { state, day, peekDay } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, card, pill, commit, toast, openTimer, rerender } from '../core.js';

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
  return `<div class="session s-${info.type}">
    <a class="session-main" href="#/session/${item.id}">
      <div class="session-head"><span class="session-title">${U.esc(info.title)}</span>${pill(status)}</div>
      <div class="session-sub">${U.esc(info.subtitle)}</div>
      ${meta ? `<div class="session-meta">${U.esc(meta)}</div>` : ''}
      ${moved}
    </a>
    <div class="btn-row">
      <a class="btn btn-primary" href="#/session/${item.id}">${status === 'done' ? 'View log' : info.type === 'cricket' ? 'Log cricket' : 'Open session'}</a>
      ${canMove ? `<button class="btn" data-act="move-open" data-id="${item.id}">${moveOpen ? 'Cancel' : 'Move'}</button>` : ''}
      ${status === 'skipped' ? `<button class="btn" data-act="unskip" data-id="${item.id}">Undo skip</button>` : ''}
    </div>
    ${movePanel}
  </div>`;
}

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
    <div class="mini-stats">
      <span>7-day avg <b>${a7 != null ? U.fmtKg(a7) : '-'}</b></span>
      <span>Target today <b>${U.fmtKg(target)}</b></span>
      ${a7 != null ? `<span>${a7 <= target + 0.05 ? 'On or ahead of target' : `${U.round1(a7 - target)} kg above target line`}</span>` : ''}
    </div>`);
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
  let html = `<div class="day-nav">
    <a class="btn btn-ghost" href="#/day/${U.addDays(t, -1)}" aria-label="Previous day">&#9664;</a>
    <div class="day-title"><div class="h1">${isToday ? 'Today' : U.esc(U.dayName(t))}</div><div class="muted">${U.fmtDateLong(t)}${n ? ` - Week ${n} of ${P.weekCount()} - ${U.esc(P.week(n).phase)}` : ''}</div></div>
    <a class="btn btn-ghost" href="#/day/${U.addDays(t, 1)}" aria-label="Next day">&#9654;</a>
  </div>`;
  if (!isToday) html += `<a class="btn btn-ghost btn-block" href="#/today">Back to today</a>`;
  html += `<div class="countdown">${daysLeft > 0 ? `<b>${daysLeft}</b> days to ${U.fmtDate(s.goalDate)} - goal ${s.goalWeight} kg` : daysLeft === 0 ? '<b>Goal weigh-in today!</b>' : `Goal date passed - ${s.goalWeight} kg target`}</div>`;
  if (isToday) html += backupBanner() + missedBanner(t);

  let sessions = items.map((i) => sessionCard(i, U.today())).join('');
  if (away) sessions += `<div class="note">${U.esc(P.sessionInfo(away.key, away.week).title)} moved to ${U.dayName(away.to)} ${U.fmtDate(away.to)}</div>`;
  if (!items.length && !away) sessions = n ? '<p class="muted">Rest day.</p>' : `<p class="muted">Outside the 9-week program (${U.fmtDate(s.startDate)} - ${U.fmtDate(s.endDate)}).</p>`;
  if (n && P.week(n).notes && U.dow(t) === 1) sessions += `<div class="note">${U.esc(P.week(n).notes)}</div>`;
  html += card(`<h2>Session</h2>${sessions}`);

  html += weighCard(t);
  html += mobilityCard(t);
  html += nutritionCard(t);
  if (n && (U.dow(t) === 0 || U.dow(t) === 6)) {
    html += card(`<h2>Weekly check-in</h2><p>Review week ${n}: weight trend, sessions, km and nutrition.</p><a class="btn btn-primary btn-block" href="#/checkin/${n}">Open week ${n} check-in</a>`);
  }
  html += card(`<h2>Bigger goal</h2><p>${U.esc(s.longTermGoal)}.</p>`, 'card-quiet');
  return { title: isToday ? 'Today' : U.fmtDate(t), html };
}
