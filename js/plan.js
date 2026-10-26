// Schedule logic (what's planned, moved, done) and progress statistics.
import { state, peekDay } from './store.js';
import * as U from './util.js';

export const CORE = ['strengthA', 'tueRun', 'strengthB', 'sunRun'];
export const isCore = (k) => CORE.includes(k);
export const isCricket = (k) => k === 'cricketTraining' || k === 'cricketGame';
export const NUTRITION_ITEMS = [
  { key: 'shake', label: 'Protein shake' },
  { key: 'protein', label: 'Protein target hit' },
  { key: 'water', label: 'Water 3 L' },
  { key: 'veg', label: 'Veg with lunch and dinner' },
  { key: 'steps', label: 'Steps 8,000+' },
];

// ---- weeks ----------------------------------------------------------------------
export const weekCount = () => state.program.weeks.length;
export function weekNum(iso) {
  const d = U.diffDays(state.settings.startDate, iso);
  if (d < 0) return null;
  const n = Math.floor(d / 7) + 1;
  return n <= weekCount() ? n : null;
}
export const week = (n) => state.program.weeks[n - 1];
export const weekStart = (n) => U.addDays(state.settings.startDate, (n - 1) * 7);
export const weekDays = (n) => Array.from({ length: 7 }, (_, i) => U.addDays(weekStart(n), i));
export function currentWeek() {
  const t = U.today();
  const n = weekNum(t);
  if (n) return n;
  return t < state.settings.startDate ? 1 : weekCount();
}

// ---- planned items ----------------------------------------------------------------
function baseItem(iso) {
  const n = weekNum(iso);
  if (!n) return null;
  const key = state.program.template[U.dow(iso)];
  if (!key) return null;
  return { id: `${iso}:${key}`, key, origDate: iso, date: iso, week: n };
}

export function itemsOn(iso) {
  const out = [];
  const b = baseItem(iso);
  if (b && !state.moves[b.id]) out.push(b);
  for (const [id, to] of Object.entries(state.moves)) {
    if (to !== iso) continue;
    const [orig, key] = id.split(':');
    out.push({ id, key, origDate: orig, date: iso, week: weekNum(orig), movedFrom: orig });
  }
  // A make-up session replaces the optional floating session.
  if (out.some((i) => i.movedFrom && isCore(i.key))) return out.filter((i) => i.key !== 'floating');
  return out;
}

export function movedAway(iso) {
  const b = baseItem(iso);
  return b && state.moves[b.id] ? { ...b, to: state.moves[b.id] } : null;
}

export function findItem(planId) {
  const [orig, key] = planId.split(':');
  const to = state.moves[planId];
  return { id: planId, key, origDate: orig, date: to || orig, week: weekNum(orig), movedFrom: to ? orig : undefined };
}

export const activityFor = (planId) => state.activities.find((a) => a.planId === planId);

export function statusOf(item, t = U.today()) {
  if (activityFor(item.id)) return 'done';
  if (state.skips[item.id]) return 'skipped';
  if (item.key === 'floating') return item.date < t ? 'past' : 'optional';
  if (isCricket(item.key)) return item.date < t ? 'unlogged' : item.date === t ? 'today' : 'planned';
  if (item.date < t) return 'missed';
  return item.date === t ? 'today' : 'planned';
}

// Training days in the same program week, from today on, with no core session already.
export function freeDays(item, from = U.today()) {
  const res = [];
  for (const d of weekDays(item.week)) {
    if (d < from || d === item.date) continue;
    if (!state.settings.trainingDays.includes(U.dow(d))) continue;
    if (itemsOn(d).some((i) => isCore(i.key))) continue;
    res.push(d);
  }
  return res;
}

export function moveItem(planId, to) {
  const orig = planId.split(':')[0];
  if (!to || to === orig) delete state.moves[planId];
  else state.moves[planId] = to;
  delete state.skips[planId];
}

export function missedThisWeek(t = U.today()) {
  const n = weekNum(t);
  if (!n) return [];
  const out = [];
  for (const d of weekDays(n)) {
    if (d >= t) break;
    for (const i of itemsOn(d)) if (isCore(i.key) && statusOf(i, t) === 'missed') out.push(i);
  }
  return out;
}

// ---- session descriptions ---------------------------------------------------------
export function sessionInfo(key, n) {
  const w = week(n) || week(1);
  const P = state.program;
  switch (key) {
    case 'strengthA':
    case 'strengthB': {
      const s = P.strength[key];
      return { type: 'strength', title: s.title, subtitle: s.subtitle, minutes: s.minutes, rounds: w.rounds, finisher: key === 'strengthA' ? w.finA : w.finB, def: s };
    }
    case 'tueRun':
      return { type: 'run', title: 'Run', subtitle: w.tue.title, minutes: w.tue.minutes, run: w.tue };
    case 'sunRun':
      return { type: 'run', title: 'Long easy run', subtitle: w.sun.title, minutes: w.sun.minutes, run: w.sun };
    case 'floating':
      return { type: 'floating', title: P.floating.title, subtitle: P.floating.subtitle };
    case 'cricketTraining':
      return { type: 'cricket', title: 'Cricket training', subtitle: 'Log it when you get home' };
    case 'cricketGame':
      return { type: 'cricket', title: 'Cricket game', subtitle: 'Long day - see the game-day fuelling list' };
    default:
      return { type: 'other', title: key, subtitle: '' };
  }
}

export const exerciseById = (id) => state.program.exercises.find((e) => e.id === id);

// Name, unit for this week (handles "single-leg from week 4" style progressions).
export function exerciseForWeek(ex, n) {
  if (ex.fromWeek && n >= ex.fromWeek && ex.laterName) return { ...ex, name: ex.laterName, unit: ex.laterUnit || ex.unit, baseName: ex.name };
  return ex;
}

export function fmtTarget(ex) {
  const r = ex.min === ex.max ? `${ex.max}` : `${ex.min} - ${ex.max}`;
  return { reps: `${r} reps`, each: `${r} each side`, sec: `${r} sec`, secEach: `${r} sec each side`, m: `${r} m` }[ex.unit] || r;
}

// ---- strength progression -----------------------------------------------------------
export function exerciseHistory(name) {
  const out = [];
  for (const a of state.activities) {
    if (a.type !== 'strength' || !a.exercises) continue;
    for (const e of a.exercises) {
      if (e.name === name && e.reps && e.reps.some((r) => r != null)) {
        out.push({ date: a.date, weight: e.weight, reps: e.reps.filter((r) => r != null), rounds: a.rounds, effort: a.effort });
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function nextWeight(w) {
  if (w == null) return null;
  const all = [...state.settings.dumbbellSingles, ...state.settings.dumbbellPairs].sort((a, b) => a - b);
  return all.find((x) => x > w) ?? null;
}

// Rule: last time all rounds were at the top of the rep range and effort was 6 or under.
export function readyToGoUp(ex, name, beforeDate = '9999-12-31') {
  const h = exerciseHistory(name).filter((x) => x.date < beforeDate);
  const last = h[h.length - 1];
  if (!last) return null;
  const allTop = last.reps.length >= (last.rounds || 1) && last.reps.every((r) => r >= ex.max);
  if (!allTop || last.effort == null || last.effort > 6) return null;
  let suggestion;
  if (ex.unit === 'sec' || ex.unit === 'secEach') suggestion = ex.load && last.weight ? `Go to ${nextWeight(last.weight) ?? last.weight + 2.5} kg or add 10 sec` : 'Add 10 sec or a harder variation';
  else if (ex.load && last.weight) suggestion = `Go to ${nextWeight(last.weight) ?? last.weight + 2.5} kg`;
  else suggestion = 'Use a harder variation, a slower tempo or a heavier band';
  return { last, suggestion };
}

// ---- weight ---------------------------------------------------------------------------
export function weights() {
  return Object.entries(state.days)
    .filter(([, d]) => d.weight != null)
    .map(([date, d]) => ({ date, w: d.weight }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function avg7(iso, list = weights()) {
  const from = U.addDays(iso, -6);
  const xs = list.filter((p) => p.date >= from && p.date <= iso).map((p) => p.w);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function targetAt(iso) {
  const s = state.settings;
  const total = U.diffDays(s.startDate, s.goalDate);
  const t = Math.min(Math.max(U.diffDays(s.startDate, iso), 0), total);
  return s.startWeight + (s.goalWeight - s.startWeight) * (t / total);
}

// Least-squares trend over the last 21 days of weigh-ins, projected to the goal date.
export function projection(list = weights()) {
  if (list.length < 3) return null;
  const lastDate = list[list.length - 1].date;
  const pts = list.filter((p) => U.diffDays(p.date, lastDate) <= 21);
  if (pts.length < 3 || U.diffDays(pts[0].date, lastDate) < 4) return null;
  const xs = pts.map((p) => U.diffDays(state.settings.startDate, p.date));
  const ys = pts.map((p) => p.w);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den ? num / den : 0;
  const goalX = U.diffDays(state.settings.startDate, state.settings.goalDate);
  return { value: my + slope * (goalX - mx), slopePerWeek: slope * 7, fromDate: pts[0].date, lastX: xs[n - 1], at: (x) => my + slope * (x - mx) };
}

export function weekAvg(n, list = weights()) {
  const days = weekDays(n);
  const xs = list.filter((p) => p.date >= days[0] && p.date <= days[6]).map((p) => p.w);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// ---- runs and weekly numbers ---------------------------------------------------------------
export const runs = () => state.activities.filter((a) => a.type === 'run' && a.distanceKm > 0).sort((a, b) => (a.date < b.date ? -1 : 1));

export function kmBetween(from, to) {
  return runs().filter((r) => r.date >= from && r.date <= to).reduce((s, r) => s + (r.distanceKm || 0), 0);
}

export function nutritionScore(iso) {
  const d = peekDay(iso);
  if (!d) return 0;
  return NUTRITION_ITEMS.filter((i) => d.n?.[i.key]).length;
}

export function weekSummary(n, t = U.today()) {
  const days = weekDays(n);
  const elapsed = days.filter((d) => d <= t);
  const list = weights();
  const avg = weekAvg(n, list);
  const prev = n > 1 ? weekAvg(n - 1, list) : state.settings.startWeight;
  let done = 0, planned = 0;
  for (const d of days) {
    for (const i of itemsOn(d)) {
      if (!isCore(i.key)) continue;
      planned++;
      if (statusOf(i, t) === 'done') done++;
    }
  }
  const mobilityDays = elapsed.filter((d) => peekDay(d)?.mobility).length;
  const ticks = elapsed.reduce((s, d) => s + nutritionScore(d), 0);
  const nutritionPct = elapsed.length ? Math.round((ticks / (elapsed.length * NUTRITION_ITEMS.length)) * 100) : 0;
  return {
    n, days, avg, prev, change: avg != null && prev != null ? avg - prev : null,
    done, planned, km: kmBetween(days[0], days[6]), mobilityDays, elapsed: elapsed.length, nutritionPct,
  };
}

// Coaching rules applied at the weekly check-in.
export function coaching(n) {
  const msgs = [];
  const s = weekSummary(n);
  if (s.avg == null) {
    msgs.push({ tone: 'info', text: 'Log a few morning weigh-ins this week to get coaching feedback.' });
    return msgs;
  }
  const drop = s.change != null ? -s.change : null;
  if (n === 1) {
    msgs.push({ tone: 'info', text: 'Week 1 often shows a bigger drop from water and glycogen. Don\'t overreact to it either way.' });
  }
  if (n >= 2 && drop != null && drop > 1) {
    msgs.push({ tone: 'warn', text: `Down ${U.round1(drop)} kg this week. That's faster than needed. Add about 150 kcal a day (e.g. an extra fist of carbs on run days) to protect energy and muscle.` });
  }
  if (n >= 2 && drop != null && drop < 0.4) {
    const p = weekSummary(n - 1);
    const prevDrop = p.change != null ? -p.change : null;
    if (prevDrop != null && prevDrop < 0.4) {
      msgs.push({ tone: 'warn', text: 'Under 0.4 kg a week for 2 weeks in a row. Cut about 150 kcal a day (e.g. drop the granola and half the rice) or add 2,000 steps a day.' });
    } else {
      msgs.push({ tone: 'info', text: `Down ${U.round1(Math.max(drop, 0))} kg this week. One slow week is normal. If next week is also under 0.4 kg, adjust.` });
    }
  }
  if (drop != null && drop >= 0.4 && (n === 1 || drop <= 1)) {
    msgs.push({ tone: 'good', text: `Down ${U.round1(drop)} kg. On track - the plan needs about 0.7 kg a week. Keep doing what you're doing.` });
  }
  return msgs;
}

// ---- streaks ------------------------------------------------------------------------------
function streak(test, t = U.today()) {
  let d = test(t) ? t : U.addDays(t, -1);
  let n = 0;
  while (test(d)) { n++; d = U.addDays(d, -1); }
  return n;
}
export function streaks() {
  return {
    mobility: streak((d) => !!peekDay(d)?.mobility),
    weighIn: streak((d) => peekDay(d)?.weight != null),
    nutrition: streak((d) => nutritionScore(d) >= 4),
  };
}

// ---- mobility routine ---------------------------------------------------------------------
// Rotates through the drill list. Calf stretch every day (calf care). 8 - 10 min, 15 min Fri and Sun.
export function mobilityRoutine(iso) {
  const list = state.program.mobility;
  const long = [5, 0].includes(U.dow(iso));
  const targetSec = long ? 15 * 60 : 9 * 60;
  const calf = list.find((m) => m.id === 'calfWall');
  const others = list.filter((m) => m !== calf);
  const offset = others.length ? (Math.abs(U.diffDays('2026-01-05', iso)) * 3) % others.length : 0;
  const picks = calf ? [calf] : [];
  let total = calf ? calf.hold * calf.sides + 10 : 0;
  for (let i = 0; i < others.length * 2 && total < targetSec; i++) {
    const m = others[(offset + i) % others.length];
    if (i >= others.length && picks.includes(m) && !long) break;
    picks.push(m);
    total += m.hold * m.sides + 10;
  }
  return { drills: picks, minutes: Math.round(total / 60), long };
}

export function mobilitySegments(drills) {
  const segs = [];
  for (const m of drills) {
    if (m.sides === 2) {
      segs.push({ l: `${m.name} - left`, s: m.hold, k: 'hold', cue: m.cue });
      segs.push({ l: `${m.name} - right`, s: m.hold, k: 'hold', cue: m.cue });
    } else segs.push({ l: m.name, s: m.hold, k: 'hold', cue: m.cue });
    segs.push({ l: 'Change', s: 5, k: 'rest' });
  }
  segs.pop();
  return segs;
}
