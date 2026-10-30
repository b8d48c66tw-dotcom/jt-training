// Shared visual building blocks: session photos and graphics, the week strip and the program grid.
import { state, peekDay } from './store.js';
import * as P from './plan.js';
import * as U from './util.js';
import { figSvg } from './figure.js';

// Simple line icons for sessions without an exercise photo.
export const ICONS = {
  run: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="30" cy="8" r="4.5"/><path d="M21 17l8-2 5 7 7 2M27 16l-4 11 7 6-2 11M23 27l-5 6-9 1M33 22l-3 7"/></svg>',
  cricket: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 6l6 6-17 17-6-6zM13 23l-6 6M10 32l-4 4"/><circle cx="35" cy="34" r="5"/></svg>',
  floating: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 30c5-6 9-6 14 0s9 6 14 0 9-6 8-3M6 20c5-6 9-6 14 0s9 6 14 0 9-6 8-3"/></svg>',
  rest: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 8a16 16 0 1 0 10 26A14 14 0 0 1 30 8z"/></svg>',
};

// Photo (or graphic) for a session: strength uses its first exercise's photo.
export function sessionVisual(item) {
  const info = P.sessionInfo(item.key, item.week);
  if (info.type === 'strength') {
    const first = P.exerciseById(info.def.exercises[0]);
    const img = first ? P.imgFor(P.exerciseForWeek(first, item.week).name) : null;
    if (img) return { key: img, photo: P.isFig(img) ? null : P.imgSrc(img, 1), ill: P.isIll(img), type: 'strength' };
  }
  const run = info.type === 'run' ? P.typeImg('run') : null;
  if (run) return { key: run, photo: P.isFig(run) ? null : P.imgSrc(run), ill: true, type: 'run' };
  return { photo: null, type: info.type === 'other' ? 'floating' : info.type };
}

// Full-bleed background layer for heroes.
export function heroBg(item) {
  const v = sessionVisual(item);
  if (P.isFig(v.key)) return `<div class="hb-fig">${figSvg(v.key.slice(4))}</div>`;
  if (v.photo) return `<div class="hb-photo${v.ill ? ' hb-ill' : ''}" style="background-image:url('${v.photo}')"></div>`;
  return `<div class="hb-graphic g-${v.type}">${ICONS[v.type] || ICONS.floating}</div>`;
}

// Small square thumbnail for list rows.
export function thumb(item, cls = '') {
  const v = sessionVisual(item);
  if (P.isFig(v.key)) return `<div class="thumb ${cls} figbox">${figSvg(v.key.slice(4))}</div>`;
  if (v.photo) return `<img class="thumb ${cls}${v.ill ? ' ill' : ''}" src="${v.photo}" alt="">`;
  return `<div class="thumb g-${v.type} ${cls}">${ICONS[v.type] || ICONS.floating}</div>`;
}
export const restThumb = () => `<div class="thumb g-rest">${ICONS.rest}</div>`;
// Graphic tile for a type (run, cricket, floating, rest, strength) with optional extra class.
export const graphic = (type, cls = 'thumb') => `<div class="${cls} g-${type}">${ICONS[type] || ICONS.floating}</div>`;
// Image tag for an exercise image key (see P.imgFor), or '' when there is none.
export const pic = (key, cls = '', frame = 1) => (!key ? '' : P.isFig(key) ? `<div class="${cls} figbox">${figSvg(key.slice(4))}</div>`
  : `<img class="${cls}${P.isIll(key) ? ' ill' : ''}" src="${P.imgSrc(key, frame)}" alt="">`);
// Thumbnail for a logged activity: strength uses its first exercise photo.
export function activityThumb(a, cls = 'thumb') {
  if (a.type === 'strength') {
    const img = P.imgFor(a.exercises?.[0]?.name) || P.imgFor(P.exerciseById(state.program.strength[a.sessionKey]?.exercises?.[0])?.name);
    if (img) return pic(img, cls);
    return graphic('strength', cls);
  }
  const ill = a.type === 'run' ? P.typeImg('run') : a.type === 'cardio' ? P.typeImg(/row/i.test(a.title || '') ? 'row' : 'bike') : null;
  if (ill) return pic(ill, cls);
  return graphic(a.type === 'run' ? 'run' : a.type === 'cricket' ? 'cricket' : a.type === 'cardio' ? 'floating' : 'rest', cls);
}

// Status of a whole day, for the week strip and program grid.
export function dayState(iso, t = U.today()) {
  const items = P.itemsOn(iso);
  const core = items.filter((i) => P.isCore(i.key));
  const cricket = items.find((i) => P.isCricket(i.key));
  const done = core.length && core.every((i) => P.statusOf(i, t) === 'done');
  const missed = core.some((i) => P.statusOf(i, t) === 'missed');
  if (done) return 'done';
  if (missed) return 'missed';
  if (cricket) return P.activityFor(cricket.id) ? 'cricket-done' : 'cricket';
  if (core.length) return 'planned';
  return 'rest';
}

// Mon - Sun strip for the week containing iso (program week if inside the program).
export function weekStrip(iso) {
  const t = U.today();
  const n = P.weekNum(iso);
  const days = n ? P.weekDays(n) : Array.from({ length: 7 }, (_, i) => U.addDays(U.mondayOf(iso), i));
  return `<div class="strip">${days.map((d) => {
    const st = dayState(d, t);
    const mark = st === 'done' || st === 'cricket-done' ? '&#10003;' : st === 'cricket' ? 'C' : U.parse(d).getDate();
    return `<a class="strip-day" href="#/day/${d}"><span class="dn ${d === iso ? 'on' : ''}">${U.dayShort(d)}</span><span class="dot st-${st} ${d === t ? 'is-today' : ''} ${d === iso ? 'is-sel' : ''}">${mark}</span></a>`;
  }).join('')}</div>`;
}

// Whole program as a grid of squares, one row per week.
export function programGrid(currentN) {
  const t = U.today();
  let done = 0, total = 0;
  const rows = [];
  for (let n = 1; n <= P.weekCount(); n++) {
    const cells = P.weekDays(n).map((d) => {
      const items = P.itemsOn(d);
      const core = items.filter((i) => P.isCore(i.key));
      total += core.length;
      const nDone = core.filter((i) => P.statusOf(i, t) === 'done').length;
      done += nDone;
      const st = dayState(d, t);
      const cls = st === 'done' ? 'sq-done' : st === 'missed' ? 'sq-missed' : st === 'planned' ? 'sq-planned'
        : st === 'cricket' ? 'sq-cricket' : st === 'cricket-done' ? 'sq-cricket-done' : 'sq-rest';
      return `<i class="sq ${cls} ${d === t ? 'sq-today' : ''}" title="${U.dayShort(d)} ${U.fmtDate(d)}"></i>`;
    }).join('');
    rows.push(`<a class="gr-row ${n === currentN ? 'on' : ''}" href="#/week/${n}"><span>W${n}</span>${cells}</a>`);
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  const s = state.settings;
  return `<section class="card program">
    <div class="card-head"><span class="disp disp-sm">9-week program</span><span class="teal small">${U.fmtDate(s.startDate)} - ${U.fmtDate(s.endDate)}</span></div>
    <div class="prog-line"><b>${done} / ${total}</b><div class="prog-bar"><i style="width:${pct}%"></i></div><span class="muted small">sessions</span></div>
    <div class="gr-head"><span></span>${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span>${x}</span>`).join('')}</div>
    ${rows.join('')}
    <div class="gr-key"><span><i class="sq sq-done"></i>Done</span><span><i class="sq sq-planned"></i>Planned</span><span><i class="sq sq-cricket"></i>Cricket</span><span><i class="sq sq-missed"></i>Missed</span></div>
  </section>`;
}

// Consecutive weeks (Mon - Sun) with at least one workout logged, counting back from this week.
export function weekStreak() {
  const has = new Set();
  for (const a of state.activities) if (['strength', 'run', 'cardio'].includes(a.type)) has.add(U.mondayOf(a.date));
  let m = U.mondayOf(U.today());
  if (!has.has(m)) m = U.addDays(m, -7);
  let n = 0;
  while (has.has(m)) { n++; m = U.addDays(m, -7); }
  return n;
}

// Is the day's habit work done? Used by the habit tiles.
export function habits(iso) {
  const d = peekDay(iso);
  return { mobility: !!d?.mobility, food: P.nutritionScore(iso), weight: d?.weight ?? null };
}
