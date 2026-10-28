// Shared UI plumbing: action registry, re-rendering, toast, small components, timer overlay.
import { state, saveState } from './store.js';
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

// summary: optional HTML shown on the start screen instead of the full step list.
export function openTimer({ title, segments, planId = null, onDoneHash = null, summary = null, meta = null }) {
  const segs = flatten(segments);
  const el = document.getElementById('timer');
  const total = totalSec(segs);
  const hasOpen = segs.some((s) => !s.s);
  el.hidden = false;
  document.body.classList.add('no-scroll');
  el.className = 'timer k-start';
  el.innerHTML = `
    <div class="t-top"><span class="t-title">${U.esc(title)}</span><button class="t-x" data-act="timer-close" aria-label="Close timer">&#10005;</button></div>
    <div class="t-ready">
      <div class="t-sum">${total ? `About ${Math.round(total / 60)} min${hasOpen ? ' plus open-ended steps' : ''}` : `${segs.length} steps`}</div>
      ${summary || `<ol class="t-list">${segs.slice(0, 40).map((s) => `<li><span>${U.esc(s.l)}${s.round ? ` (${s.round}/${s.rounds})` : ''}</span><b>${s.s ? U.fmtDuration(s.s) : 'tap Next'}</b></li>`).join('')}${segs.length > 40 ? '<li>...</li>' : ''}</ol>`}
      <p class="t-note">Keep this screen open - it stays awake and beeps at each change. If the phone locks, the timer catches up when you unlock it.</p>
      <button class="btn btn-xl btn-go" data-act="timer-start">Start</button>
    </div>`;
  active = { segs, title, planId, onDoneHash, timer: null, shownImg: undefined, meta };
}

function renderRunning(v) {
  const el = document.getElementById('timer');
  const s = v.seg;
  if (v.finished) {
    el.className = 'timer k-done';
    el.innerHTML = `
      <div class="t-top"><span class="t-title">${U.esc(active.title)}</span><button class="t-x" data-act="timer-close" aria-label="Close timer">&#10005;</button></div>
      <div class="t-main"><div class="t-label">Done</div><div class="t-big">${U.fmtDuration(v.totalElapsed)}</div><div class="t-sub">total time</div></div>
      <div class="t-ctrl"><button class="btn btn-xl btn-go" data-act="timer-log">Log it</button></div>`;
    return;
  }
  // Build the layout once, then only update text so taps on the buttons are never lost.
  if (!el.querySelector('.t-main.live')) {
    el.innerHTML = `
      <div class="t-top"><span class="t-title">${U.esc(active.title)}</span><button class="t-x" data-act="timer-close" aria-label="Close timer">&#10005;</button></div>
      <div class="t-main live">
        <div class="t-img" data-r="img"></div>
        <div class="t-kind" data-r="kind"></div>
        <div class="t-label" data-r="label"></div>
        <div class="t-big" data-r="big"></div>
        <div class="t-sub" data-r="sub"></div>
        <div class="t-cue" data-r="cue"></div>
        <div class="t-next" data-r="next"></div>
      </div>
      <div class="t-foot" data-r="foot"></div>
      <div class="t-ctrl">
        <button class="btn btn-lg" data-act="timer-prev" aria-label="Previous">&#9664;&#9664;</button>
        <button class="btn btn-xl" data-act="timer-pause" data-r="pause"></button>
        <button class="btn btn-lg" data-act="timer-next" aria-label="Next">&#9654;&#9654;</button>
      </div>`;
  }
  const set = (r, text) => { const n = el.querySelector(`[data-r="${r}"]`); if (n.textContent !== text) n.textContent = text; };
  el.className = `timer k-${s.k || 'run'}${v.paused ? ' paused' : ''}`;
  set('kind', `${KIND_LABEL[s.k] || ''}${s.round ? ` - round ${s.round} of ${s.rounds}` : ''}`);
  set('label', s.l || '');
  set('big', s.s ? U.fmtDuration(Math.ceil(v.remaining)) : U.fmtDuration(v.elapsed));
  set('sub', s.s ? s.sub || '' : `${s.sub ? `${s.sub} - ` : ''}counting up - tap Next when done`);
  set('cue', s.k === 'work' || s.k === 'hold' || s.k === 'warm' ? s.cue || '' : '');
  // Exercise photo: the current exercise, or the next one during rests. Only swap when it changes.
  const img = s.img || (s.k === 'rest' ? v.next?.img : null) || null;
  if (active.shownImg !== img) {
    active.shownImg = img;
    el.querySelector('[data-r="img"]').innerHTML = flip(img, 'flip-timer');
  }
  set('next', v.next ? `Next: ${v.next.l}${v.next.s ? ` (${U.fmtDuration(v.next.s)})` : ''}` : 'Last step');
  set('foot', `Step ${v.idx + 1} of ${v.count} - elapsed ${U.fmtDuration(v.totalElapsed)}${v.totalRemaining != null ? ` - about ${Math.ceil(v.totalRemaining / 60)} min left` : ''}`);
  set('pause', v.paused ? 'Resume' : 'Pause');
}

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
    // Sessions that get logged: stopping early still takes you to the log with what you did.
    if (active.onDoneHash) {
      if (!confirm('Stop the session here? You can log what you did.')) return;
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
  active.segs.forEach((s, i) => { if (s.fin) lastFin = i; });
  for (let i = 0; i < reached; i++) {
    const s = active.segs[i];
    if (s.k === 'work' && s.round) rounds = Math.max(rounds, s.round);
  }
  // Finisher counts as done once every finisher step has been passed.
  ui.timerResult = { ...(active.meta || {}), planId: active.planId, sec: Math.round(t.totalElapsed), rounds, fin: lastFin >= 0 && reached > lastFin };
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
