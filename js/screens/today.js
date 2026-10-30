// Today (or any single day): session, weigh-in, mobility, nutrition.
import { state, day, peekDay } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, card, commit, toast, openTimer, rerender, flip } from '../core.js';
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
  return `<div class="hero2 s-${info.type}">
    ${heroBg(item)}<div class="hb-shade"></div>
    <div class="hero2-in">
      <div class="tags">${statusChip}${status !== 'done' ? sessionChips(item).map((c) => `<span class="tag">${c}</span>`).join('') : ''}${item.movedFrom ? `<span class="tag">From ${U.dayShort(item.movedFrom)}</span>` : ''}</div>
      <a class="disp hero2-title" href="#/session/${item.id}">${U.esc(info.title)}</a>
      <div class="hero2-sub">${U.esc(sub)}</div>
      ${item.extra?.note ? `<div class="hero2-note">${U.esc(item.extra.note)}</div>` : ''}
      ${primaryAction(item, status)}
      <div class="hero2-links"><a href="#/session/${item.id}">Details</a>${canMove ? `<button data-act="move-open" data-id="${item.id}">Move</button>` : ''}${status === 'skipped' ? `<button data-act="unskip" data-id="${item.id}">Undo skip</button>` : ''}</div>
    </div>
  </div>${movePanel(item)}`;
}

const restIcon = () => '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 8a16 16 0 1 0 10 26A14 14 0 0 1 30 8z"/></svg>';
on('jump', (el) => document.getElementById(el.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
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
  return card(`<h2 id="c-weigh">Morning weigh-in</h2>
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
  return card(`<div class="card-head" id="c-mob"><h2>Mobility - ${r.minutes} min${r.long ? ' (long flow)' : ''}</h2></div>
    <button class="tick ${done ? 'on' : ''}" data-act="toggle-mob" data-date="${t}"><span class="box">${done ? '&#10003;' : ''}</span>${done ? 'Mobility done' : 'Tick when done'}</button>
    <ul class="drills">${r.drills.map((m) => `<li class="drill">${flip(P.imgFor(m.name), 'flip-sm') || '<div class="flip-sm flip-none"></div>'}<div><b>${U.esc(m.name)}</b> <span class="muted">${m.sides === 2 ? `${m.hold} sec each side` : `${m.hold} sec`}</span><div class="cue">${U.esc(m.cue)}</div></div></li>`).join('')}</ul>
    <button class="btn btn-lg btn-block" data-act="mob-timer" data-date="${t}">Start guided routine</button>`);
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
  return card(`<div class="card-head" id="c-food"><h2>Nutrition</h2><span class="score">${score}/${P.NUTRITION_ITEMS.length}</span></div>
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
  const phase = n ? `Week ${n} - ${P.week(n).phase}` : t < s.startDate ? `Starts ${U.dayName(s.startDate)} ${U.fmtDate(s.startDate)}` : 'Program finished';
  let html = `<div class="today-head">
    <div><div class="kick">${U.esc(phase)}</div><div class="today-date">${U.esc(U.fmtDateLong(t))}</div></div>
    <div class="goal-pill"><b>${daysLeft > 0 ? daysLeft : 0}</b><span>days to ${U.fmtDate(s.goalDate)}</span></div>
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
  html += `<div class="habits">
    <button class="hab" data-act="jump" data-to="c-weigh"><span class="kick">Weight</span><b>${d?.weight ?? (a7 != null ? U.round1(a7).toFixed(1) : '-')}</b><span class="hab-bar"><i style="width:${wPct}%;background:var(--accent)"></i></span></button>
    <button class="hab" data-act="jump" data-to="c-food"><span class="kick">Food</span><b>${food}/5</b><span class="hab-bar"><i style="width:${food * 20}%;background:var(--accent-2)"></i></span></button>
    <button class="hab" data-act="jump" data-to="c-mob"><span class="kick">Mobility</span><b>${d?.mobility ? '&#10003;' : `${mob.minutes} min`}</b><span class="hab-bar"><i style="width:${d?.mobility ? 100 : 0}%;background:var(--violet)"></i></span></button>
  </div>`;

  html += weighCard(t);
  html += mobilityCard(t);
  html += nutritionCard(t);
  if (n && U.diffDays(t, P.weekDays(n)[6]) <= 1) {
    html += card(`<h2>Weekly check-in</h2><p>Review week ${n}: weight trend, sessions, km and nutrition.</p><a class="btn btn-primary btn-block" href="#/checkin/${n}">Open week ${n} check-in</a>`);
  }
  html += card(`<h2>Bigger goal</h2><p>${U.esc(s.longTermGoal)}.</p>`, 'card-quiet');
  return { title: isToday ? 'Today' : U.fmtDate(t), html };
}
