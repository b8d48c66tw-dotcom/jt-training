// Shared UI plumbing: action registry, re-rendering, toast, small components, timer overlay.
import { state, saveState, day } from './store.js';
import * as P from './plan.js';
import { weekStreak } from './visual.js';
import { IntervalTimer, flatten, totalSec } from './timer.js';
import * as U from './util.js';

export const actions = {};
export const on = (name, fn) => { actions[name] = fn; };
export const ui = {}; // transient screen state (open panels, filters, timer results)

let renderFn = () => {};
export const setRenderer = (fn) => { renderFn = fn; };
export function rerender(keepScroll = true) {
  const y = window.scrollY;
  renderFn();
  if (keepScroll) window.scrollTo(0, y);
}
export const go = (hash) => { if (location.hash === hash) rerender(false); else location.hash = hash; };
export async function commit(keepScroll = true) { rerender(keepScroll); await saveState(); }

export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---- components ---------------------------------------------------------------------
export const card = (inner, cls = '') => `<section class="card ${cls}">${inner}</section>`;
export const STATUS_LABEL = { done: 'Done', missed: 'Missed', moved: 'Moved', skipped: 'Skipped', today: 'Today', planned: 'Planned', optional: 'Optional', unlogged: 'Not logged', past: 'Optional' };
export const pill = (status, label) => `<span class="pill pill-${status}">${status === 'done' ? '&#10003; ' : ''}${U.esc(label || STATUS_LABEL[status] || status)}</span>`;

export function scale(name, value, { min = 1, max = 10, label = '' } = {}) {
  let b = '';
  for (let i = min; i <= max; i++) b += `<button type="button" class="sc ${Number(value) === i ? 'on' : ''}" data-act="pick" data-name="${name}" data-val="${i}">${i}</button>`;
  return `<div class="field"><span class="lbl">${U.esc(label)}</span><div class="scale">${b}</div><input type="hidden" name="${name}" value="${value ?? ''}"></div>`;
}
on('pick', (el) => {
  const wrap = el.closest('.field');
  wrap.querySelectorAll('.sc').forEach((b) => b.classList.toggle('on', b === el));
  wrap.querySelector('input[type=hidden]').value = el.dataset.val;
});

export const field = (label, input, hint = '') =>
  `<label class="field"><span class="lbl">${U.esc(label)}</span>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;

export function stat(label, value, sub = '') {
  return `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${U.esc(label)}</div>${sub ? `<div class="stat-s">${sub}</div>` : ''}</div>`;
}

// Concentric activity rings, outer to inner. items: [{ pct (0-1), color }]
export function rings(items, centreBig = '', centreSmall = '', size = 176) {
  const stroke = 13, gap = 4;
  let svg = '';
  items.forEach((it, i) => {
    const r = size / 2 - stroke / 2 - i * (stroke + gap);
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(1, it.pct || 0));
    svg += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="${stroke}"/>`;
    if (pct > 0) svg += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
  });
  if (centreBig !== '') {
    svg += `<text x="50%" y="${size / 2 + 4}" text-anchor="middle" class="ring-big">${U.esc(centreBig)}</text>`;
    svg += `<text x="50%" y="${size / 2 + 24}" text-anchor="middle" class="ring-small">${U.esc(centreSmall)}</text>`;
  }
  return `<svg class="rings" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Daily progress rings">${svg}</svg>`;
}

export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  }
  return o;
}

// ---- timer overlay ----------------------------------------------------------------------
const KIND_LABEL = {
  warm: 'Warm-up', cool: 'Cool-down', run: 'Run', walk: 'Walk', tempo: 'Tempo', jog: 'Jog', stride: 'Stride', hard: 'Hard', easy: 'Easy',
  rest: 'Rest', hold: 'Hold', work: 'Work', ready: 'Get ready', switch: 'Switch',
};
let active = null;

// Two-photo "flipbook" demo of an exercise (start and end positions, cross-fading).
export function flip(imgId, cls = '') {
  if (!imgId) return '';
  return `<div class="flip ${cls}" role="img" aria-label="Exercise demonstration"><img src="img/ex/${imgId}-0.jpg" alt=""><img src="img/ex/${imgId}-1.jpg" alt=""></div>`;
}

// ---- live player -----------------------------------------------------------------------------------
// Sections for the progress bar (warm-up, each round, finisher, cool-down).
const sectionOf = (sg) => sg.sec || (sg.round ? `Round ${sg.round}` : sg.k === 'warm' ? 'Warm-up' : sg.k === 'cool' ? 'Cool-down' : 'Main');
const segLen = (sg) => sg.s || 60;
function buildSections(segs) {
  const out = [];
  segs.forEach((sg, i) => {
    const name = sectionOf(sg);
    const last = out[out.length - 1];
    if (last && last.name === name) { last.end = i; last.total += segLen(sg); } else out.push({ name, start: i, end: i, total: segLen(sg) });
  });
  return out;
}
const setKey = (sg) => `${sg.ex}:${sg.round}`;

// summary: optional HTML shown on the start screen instead of the full step list.
// meta.guided marks a guided strength session (set logging and the completion screen).
export function openTimer({ title, segments, planId = null, onDoneHash = null, summary = null, meta = null }) {
  const segs = flatten(segments);
  const el = document.getElementById('timer');
  const total = totalSec(segs);
  const hasOpen = segs.some((sg) => !sg.s);
  const bgImg = segs.find((sg) => sg.k === 'work' && sg.img)?.img || segs.find((sg) => sg.img)?.img;
  el.hidden = false;
  document.body.classList.add('no-scroll');
  el.className = 'timer k-start';
  el.innerHTML = `
    ${bgImg ? `<div class="pl-bg">${flip(bgImg, 'flip-bg')}</div><div class="pl-shade"></div>` : ''}
    <div class="t-top"><span class="t-title">${U.esc(title)}</span><button class="t-x" data-act="timer-close" aria-label="Close timer">&#10005;</button></div>
    <div class="t-ready">
      <div class="disp pl-start-title">${U.esc(title.replace(/ - \d+ rounds$/, ''))}</div>
      <div class="t-sum">${total ? `About ${Math.round(total / 60)} min${hasOpen ? ' plus open-ended steps' : ''}` : `${segs.length} steps`}</div>
      ${summary || `<ol class="t-list">${segs.slice(0, 40).map((sg) => `<li><span>${U.esc(sg.l)}${sg.round ? ` (${sg.round}/${sg.rounds})` : ''}</span><b>${sg.s ? U.fmtDuration(sg.s) : 'tap Next'}</b></li>`).join('')}${segs.length > 40 ? '<li>...</li>' : ''}</ol>`}
      ${state.settings.musicUrl ? '<button class="btn btn-block t-music" data-act="open-music">Open my workout playlist</button>' : ''}
      <p class="t-note">Keep this screen open - it stays awake and gives cues at each change. If the phone locks, the timer catches up when you unlock it.</p>
      <button class="cta cta-block" data-act="timer-start">Start</button>
    </div>`;
  active = { segs, title, planId, onDoneHash, timer: null, shownImg: undefined, meta, sections: buildSections(segs), sets: {}, sheetKey: null, effort: 7 };
  active.fixedTotal = segs.reduce((a, sg) => a + segLen(sg), 0);
}

// Record the default (target) result for every set that has been worked so far.
function fillSets(upTo) {
  for (let i = 0; i < upTo; i++) {
    const sg = active.segs[i];
    if (sg.k !== 'work' || sg.ex == null) continue;
    const k = setKey(sg);
    if (!active.sets[k]) {
      const timed = sg.unit === 'sec' || sg.unit === 'secEach';
      active.sets[k] = { reps: timed ? sg.max : sg.max, kg: sg.load ? sg.kg ?? null : null, timed };
    }
  }
}
// The set to log while resting: the last exercise worked before this step.
function sheetSet(idx) {
  const cur = active.segs[idx];
  if (!active.meta?.guided || !cur || !['ready', 'rest'].includes(cur.k)) return null;
  for (let i = idx - 1; i >= 0; i--) {
    const sg = active.segs[i];
    if (sg.k === 'work' && sg.ex != null) return sg;
    if (sg.k === 'ready' || sg.k === 'warm') return null;
  }
  return null;
}
function renderSheet(el, sg) {
  const box = el.querySelector('[data-r="sheet"]');
  if (!sg) { box.hidden = true; active.sheetKey = null; return; }
  const k = setKey(sg);
  if (active.sheetKey === k) return;
  active.sheetKey = k;
  const v = active.sets[k];
  const unitLbl = { reps: 'Reps', each: 'Reps each side', sec: 'Seconds', secEach: 'Sec each side', m: 'Metres' }[sg.unit] || 'Reps';
  const stepper = (f, val, lbl) => `<div class="stepper"><button data-act="set-adj" data-f="${f}" data-d="-1" aria-label="Less">&#8722;</button><div><b data-r="sv-${f}">${val ?? '-'}</b><small>${lbl}</small></div><button data-act="set-adj" data-f="${f}" data-d="1" aria-label="More">+</button></div>`;
  box.innerHTML = `<div class="kick teal">Log set - ${U.esc(sg.name)}, round ${sg.round}</div>
    <div class="steppers">${stepper('reps', v.reps, unitLbl)}${sg.load ? stepper('kg', v.kg, 'Kg') : ''}</div>
    <div class="sheet-note">Saved automatically - adjust if you missed any.</div>`;
  box.hidden = false;
}

function renderRunning(v) {
  const el = document.getElementById('timer');
  const sg = v.seg;
  if (v.finished) return renderDone(el, v);
  if (!el.querySelector('.t-main.live')) {
    el.innerHTML = `
      <div class="pl-bg" data-r="bg"></div><div class="pl-shade"></div>
      <div class="pl-top"><span class="pl-time" data-r="top"></span><button class="t-x" data-act="timer-close" aria-label="Close timer">&#10005;</button></div>
      <div class="pl-bar">${active.sections.map((sec, i) => `<i style="flex:${sec.total}" title="${U.esc(sec.name)}"><b data-sec="${i}"></b></i>`).join('')}</div>
      <div class="t-main live">
        <div class="pl-kind" data-r="kind"></div>
        <div class="disp pl-label" data-r="label"></div>
        <div class="pl-sub" data-r="sub"></div>
        <div class="pl-clock" data-r="big"></div>
        <div class="pl-cue" data-r="cue"></div>
        <div class="pl-next" data-r="next"></div>
      </div>
      <div class="pl-sheet" data-r="sheet" hidden></div>
      <div class="t-ctrl">
        <button class="btn btn-lg" data-act="timer-prev" aria-label="Previous">&#9664;&#9664;</button>
        <button class="btn btn-xl" data-act="timer-pause" data-r="pause"></button>
        <button class="btn btn-lg" data-act="timer-next" aria-label="Next">&#9654;&#9654;</button>
      </div>`;
  }
  const set = (r, text) => { const n = el.querySelector(`[data-r="${r}"]`); if (n && n.textContent !== text) n.textContent = text; };
  el.className = `timer player k-${sg.k || 'run'}${v.paused ? ' paused' : ''}`;
  // Progress: fixed-length time done so far, per section.
  let doneSec = 0;
  for (let i = 0; i < v.idx; i++) doneSec += segLen(active.segs[i]);
  doneSec += Math.min(v.elapsed, segLen(sg));
  const pct = Math.min(100, Math.round((doneSec / active.fixedTotal) * 100));
  set('top', `${U.fmtDuration(v.totalElapsed)} - ${pct}%`);
  let acc = 0;
  active.sections.forEach((sec, i) => {
    const fill = Math.max(0, Math.min(1, (doneSec - acc) / sec.total));
    acc += sec.total;
    const b = el.querySelector(`[data-sec="${i}"]`);
    if (b) b.style.width = `${Math.round(fill * 100)}%`;
  });
  const roundTxt = sg.round ? ` - Round ${sg.round} of ${sg.rounds}` : sg.finRound ? ` - ${sg.finRound} of ${sg.finRounds}` : '';
  set('kind', `${KIND_LABEL[sg.k] || ''}${roundTxt}`);
  set('label', (sg.l || '').replace(/^Get ready: /, ''));
  set('big', sg.s ? U.fmtDuration(Math.ceil(v.remaining)) : U.fmtDuration(v.elapsed));
  set('sub', sg.s ? sg.sub || '' : `${sg.sub ? `${sg.sub} - ` : ''}counting up - tap Next when done`);
  set('cue', sg.k === 'work' || sg.k === 'hold' || sg.k === 'warm' ? sg.cue || '' : '');
  set('next', v.next ? `Next: ${v.next.l.replace(/^Get ready: /, '')}${v.next.s ? ` - ${U.fmtDuration(v.next.s)}` : ''}` : 'Last step');
  set('pause', v.paused ? 'Resume' : 'Pause');
  // Background photo: this exercise, or the next one during rests.
  const img = sg.img || (sg.k === 'rest' ? v.next?.img : null) || null;
  if (active.shownImg !== img) {
    active.shownImg = img;
    el.querySelector('[data-r="bg"]').innerHTML = flip(img, 'flip-bg');
  }
  if (active.meta?.guided) {
    if (active.lastIdx !== v.idx) { fillSets(v.idx); active.lastIdx = v.idx; }
    renderSheet(el, sheetSet(v.idx));
  }
}

on('set-adj', (el) => {
  const k = active?.sheetKey;
  if (!k || !active.sets[k]) return;
  const v = active.sets[k];
  const d = Number(el.dataset.d);
  if (el.dataset.f === 'reps') v.reps = Math.max(0, (v.reps ?? 0) + d * (v.timed ? 5 : 1));
  else if (v.kg == null) v.kg = d > 0 ? Math.min(...state.settings.dumbbellPairs) : null; // first tap: lightest pair
  else v.kg = d > 0 ? (P.nextWeight(v.kg) ?? v.kg + 2.5) : (P.prevWeight(v.kg) || null);
  const out = document.querySelector(`[data-r="sv-${el.dataset.f}"]`);
  if (out) out.textContent = el.dataset.f === 'reps' ? v.reps : v.kg ?? '-';
});

// ---- completion -----------------------------------------------------------------------------------------
function guidedSummaryData() {
  const t = active.timer;
  const reached = t.finished ? active.segs.length : t.idx;
  fillSets(reached);
  const byEx = new Map();
  for (const sg of active.segs) {
    if (sg.k !== 'work' || sg.ex == null || byEx.has(sg.ex)) continue;
    byEx.set(sg.ex, { id: sg.exId, name: sg.name, unit: sg.unit, load: sg.load, reps: [], weight: null });
  }
  let rounds = 0, totalReps = 0, volume = 0;
  for (const [k, v] of Object.entries(active.sets)) {
    const [ex, round] = k.split(':').map(Number);
    const e = byEx.get(ex);
    if (!e) continue;
    e.reps[round - 1] = v.reps;
    if (v.kg != null) e.weight = v.kg;
    rounds = Math.max(rounds, round);
    if (!v.timed) {
      const reps = (v.reps || 0) * (e.unit === 'each' ? 2 : 1);
      totalReps += reps;
      volume += reps * (v.kg || 0);
    }
  }
  const exercises = [...byEx.values()].map((e) => ({ ...e, reps: Array.from({ length: e.reps.length }, (_, i) => e.reps[i] ?? null) }));
  let lastFin = -1;
  active.segs.forEach((sg, i) => { if (sg.fin) lastFin = i; });
  const date = active.meta.date || U.today();
  let pbs = 0;
  for (const e of exercises) {
    if (!e.weight) continue;
    const best = Math.max(0, ...P.exerciseHistory(e.name).filter((h) => h.date < date).map((h) => h.weight || 0));
    if (best && e.weight > best) pbs++;
  }
  return { exercises, rounds, totalReps, volume, pbs, fin: lastFin >= 0 && reached > lastFin, sec: Math.round(t.totalElapsed), date };
}

function renderDone(el, v) {
  if (active.doneShown) return;
  active.doneShown = true;
  el.className = 'timer player k-done';
  const guided = active.meta?.guided;
  const mobilityDate = active.meta?.mobilityDate;
  if (mobilityDate) { day(mobilityDate).mobility = true; saveState(); }
  const hasThisWeek = state.activities.some((a) => ['strength', 'run', 'cardio'].includes(a.type) && U.mondayOf(a.date) === U.mondayOf(U.today()));
  const streak = weekStreak() + (hasThisWeek ? 0 : 1);
  const title = active.title.replace(/ - \d+ rounds$/, '');
  let body;
  if (guided) {
    const d = active.summaryData = guidedSummaryData();
    const vol = d.volume >= 1000 ? `${U.round1(d.volume / 1000)}k` : String(Math.round(d.volume));
    body = `<div class="stats3">
        <div><b>${U.fmtDuration(d.sec)}</b><span>Total time</span></div>
        <div><b>${vol}</b><span>Kg lifted</span></div>
        <div><b>${d.totalReps}</b><span>Total reps</span></div>
        <div><b>${d.rounds}/${active.segs.find((x) => x.rounds)?.rounds || d.rounds}</b><span>Rounds</span></div>
        <div><b>${d.fin ? '&#10003;' : '-'}</b><span>Finisher</span></div>
        <div><b>${d.pbs ? `+${d.pbs}` : '0'}</b><span>Heavier lifts</span></div>
      </div>
      <div class="kick done-q">How hard was it?</div>
      <div class="effort">${[5, 6, 7, 8, 9].map((n) => `<button class="${n === active.effort ? 'on' : ''}" data-act="done-effort" data-v="${n}">${n}</button>`).join('')}</div>
      <button class="cta cta-block" data-act="done-save">Save session</button>
      <button class="btn btn-ghost btn-block" data-act="timer-log">Edit details first</button>`;
  } else if (mobilityDate) {
    body = `<div class="stats3 two"><div><b>${U.fmtDuration(v.totalElapsed)}</b><span>Total time</span></div><div><b>&#10003;</b><span>Mobility ticked</span></div></div>
      <button class="cta cta-block" data-act="timer-close">Done</button>`;
  } else {
    body = `<div class="stats3 two"><div><b>${U.fmtDuration(v.totalElapsed)}</b><span>Total time</span></div><div><b>${streak}</b><span>Week streak</span></div></div>
      ${active.onDoneHash ? '<button class="cta cta-block" data-act="timer-log">Log it</button>' : '<button class="cta cta-block" data-act="timer-close">Done</button>'}`;
  }
  el.innerHTML = `<div class="t-top"><span class="t-title"></span><button class="t-x" data-act="timer-close" aria-label="Close">&#10005;</button></div>
    <div class="done">
      <div class="badge"><div class="disp">${mobilityDate ? 'Mobility<br>done' : 'Session<br>complete'}</div></div>
      ${mobilityDate ? '' : `<div class="streak">&#9889; ${streak} week streak ${'<i></i>'.repeat(Math.min(streak, 6))}</div>`}
      <div class="kick">${U.fmtDateLong(active.meta?.date || active.meta?.mobilityDate || (active.planId ? active.planId.slice(0, 10) : U.today()))}</div>
      <div class="disp done-title">${U.esc(title)}</div>
      ${body}
    </div>`;
}
on('done-effort', (el) => {
  active.effort = Number(el.dataset.v);
  el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
});
on('done-save', () => {
  const d = active.summaryData;
  const m = active.meta;
  const info = P.sessionInfo(m.key, m.n);
  state.activities.push({
    id: U.uid(), date: d.date, type: 'strength', title: info.title, sessionKey: m.key, planId: active.planId,
    exercises: d.exercises.map((e) => ({ id: e.id, name: e.name, weight: e.weight, reps: e.reps, unit: e.unit })),
    rounds: d.rounds, effort: active.effort, finisherDone: d.fin, finisher: info.finisher.label,
    durationSec: d.sec, avgHr: null, notes: '', source: 'manual', externalId: null, created: new Date().toISOString(),
  });
  if (active.planId) delete state.skips[active.planId];
  closeTimer();
  toast('Session saved. Nice work.');
  commit(false);
  go('#/today');
});

on('open-music', () => {
  const url = String(state.settings.musicUrl || '').trim();
  if (/^https:\/\//i.test(url)) window.open(url, '_blank');
  else toast('Paste a playlist link starting with https:// in Settings');
});
on('timer-start', () => {
  active.timer = new IntervalTimer(active.segs, { onTick: renderRunning });
  active.timer.start();
});
on('timer-pause', () => { const t = active?.timer; if (!t) return; t.pausedAt == null ? t.pause() : t.resume(); });
on('timer-next', () => active?.timer?.next());
on('timer-prev', () => active?.timer?.prev());
on('timer-close', () => {
  const t = active?.timer;
  if (t && t.running && !t.finished) {
    // Guided sessions: stopping early shows the completion screen with what you did.
    if (active.meta?.guided) {
      if (!confirm('Finish the session here? You can save what you did.')) return;
      t.stop();
      return renderDone(document.getElementById('timer'), t.view());
    }
    if (active.onDoneHash) {
      if (!confirm('Stop here? You can log what you did.')) return;
      return timerLog();
    }
    if (!confirm('Stop the timer?')) return;
  }
  closeTimer();
});
function timerLog() {
  const t = active.timer;
  const reached = t.finished ? active.segs.length : t.idx;
  let rounds = 0, lastFin = -1;
  active.segs.forEach((sg, i) => { if (sg.fin) lastFin = i; });
  for (let i = 0; i < reached; i++) {
    const sg = active.segs[i];
    if (sg.k === 'work' && sg.round) rounds = Math.max(rounds, sg.round);
  }
  if (active.meta?.guided) fillSets(reached);
  ui.timerResult = { ...(active.meta || {}), planId: active.planId, sec: Math.round(t.totalElapsed), rounds, fin: lastFin >= 0 && reached > lastFin, sets: active.sets };
  const hash = active.onDoneHash;
  closeTimer();
  if (hash) go(hash);
}
on('timer-log', timerLog);
function closeTimer() {
  active?.timer?.stop();
  active = null;
  const el = document.getElementById('timer');
  el.hidden = true;
  el.className = '';
  el.innerHTML = '';
  document.body.classList.remove('no-scroll');
}
