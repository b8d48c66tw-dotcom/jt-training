// Interval timer: wall-clock based so it catches up after the phone sleeps.
// Beeps (Web Audio), voice (speech synthesis), vibration where supported, and a
// screen wake lock while running.
import { state } from './store.js';

export function flatten(segments) {
  const out = [];
  for (const s of segments || []) {
    if (s.x) {
      for (let r = 1; r <= s.x; r++) {
        s.items.forEach((it, j) => {
          if (s.dropLast && r === s.x && j === s.items.length - 1) return;
          out.push({ ...it, round: r, rounds: s.x });
        });
      }
    } else out.push({ ...s });
  }
  return out;
}

export const totalSec = (segs) => segs.reduce((a, s) => a + (s.s || 0), 0);

let audio = null;
function ctx() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
  }
  if (audio && audio.state === 'suspended') audio.resume();
  return audio;
}
function tone(freq, dur, when = 0, vol = 0.6) {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + when + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + when);
  o.stop(a.currentTime + when + dur + 0.05);
}
export function beepShort() { if (state.settings.timerSound) tone(880, 0.12); }
export function beepChange() {
  if (state.settings.timerSound) { tone(1320, 0.25); tone(1320, 0.4, 0.32); }
  if (state.settings.timerVibrate) navigator.vibrate?.([250, 120, 250]);
}
export function beepDone() {
  if (state.settings.timerSound) { tone(990, 0.2); tone(1320, 0.2, 0.25); tone(1760, 0.5, 0.5); }
  if (state.settings.timerVibrate) navigator.vibrate?.([400, 150, 400, 150, 400]);
}
function say(text) {
  if (!state.settings.timerVoice || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/ - tap Next when done/i, ''));
    u.lang = 'en-AU';
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

let wakeLock = null;
async function lockScreen() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) { wakeLock = null; }
}
function releaseScreen() { try { wakeLock?.release(); } catch (e) { /* ignore */ } wakeLock = null; }

export class IntervalTimer {
  constructor(segments, { onTick, onDone } = {}) {
    this.segs = segments;
    this.onTick = onTick || (() => {});
    this.onDone = onDone || (() => {});
    this.idx = 0;
    this.segStart = 0;      // wall-clock ms when the current segment started
    this.pausedAt = null;
    this.startedAt = null;
    this.pausedTotal = 0;
    this.running = false;
    this.lastBeep = null;
    this.finished = false;
    this.onVis = () => { if (document.visibilityState === 'visible' && this.running) { lockScreen(); this.tick(); } };
  }
  start() {
    ctx(); // unlock audio on the user's tap
    const now = Date.now();
    this.startedAt = now;
    this.segStart = now;
    this.running = true;
    lockScreen();
    document.addEventListener('visibilitychange', this.onVis);
    this.announce();
    this.interval = setInterval(() => this.tick(), 200);
    this.tick();
  }
  announce() {
    const s = this.segs[this.idx];
    if (!s) return;
    say(s.l + (s.round ? `. Round ${s.round} of ${s.rounds}` : ''));
  }
  get elapsedInSeg() {
    const now = this.pausedAt ?? Date.now();
    return (now - this.segStart) / 1000;
  }
  get totalElapsed() {
    if (!this.startedAt) return 0;
    const now = this.pausedAt ?? Date.now();
    return (now - this.startedAt - this.pausedTotal) / 1000;
  }
  tick() {
    if (!this.running || this.finished) return;
    if (this.pausedAt == null) {
      // Catch up through any segments that ended while the screen was off.
      let changed = false;
      let guard = 0;
      while (guard++ < 500) {
        const s = this.segs[this.idx];
        if (!s || !s.s) break;
        if (this.elapsedInSeg < s.s) break;
        this.segStart += s.s * 1000;
        this.idx++;
        changed = true;
        if (this.idx >= this.segs.length) return this.finish();
      }
      if (changed) { beepChange(); this.announce(); }
      const s = this.segs[this.idx];
      if (s && s.s) {
        const left = Math.ceil(s.s - this.elapsedInSeg);
        if (left <= 3 && left >= 1 && this.lastBeep !== `${this.idx}:${left}`) {
          this.lastBeep = `${this.idx}:${left}`;
          beepShort();
        }
      }
    }
    this.onTick(this.view());
  }
  view() {
    const s = this.segs[this.idx] || {};
    const remaining = s.s ? Math.max(0, s.s - this.elapsedInSeg) : null;
    const after = this.segs.slice(this.idx + 1).reduce((a, x) => a + (x.s || 0), 0);
    return {
      seg: s, idx: this.idx, count: this.segs.length, next: this.segs[this.idx + 1] || null,
      remaining, elapsed: this.elapsedInSeg, totalElapsed: this.totalElapsed,
      totalRemaining: s.s ? remaining + after : null, paused: this.pausedAt != null, finished: this.finished,
    };
  }
  pause() {
    if (this.pausedAt != null) return;
    this.pausedAt = Date.now();
    this.onTick(this.view());
  }
  resume() {
    if (this.pausedAt == null) return;
    const gap = Date.now() - this.pausedAt;
    this.segStart += gap;
    this.pausedTotal += gap;
    this.pausedAt = null;
    ctx();
    this.tick();
  }
  next() {
    if (this.finished) return;
    const now = this.pausedAt ?? Date.now();
    this.idx++;
    this.segStart = now;
    if (this.idx >= this.segs.length) return this.finish();
    beepChange();
    this.announce();
    this.onTick(this.view());
  }
  prev() {
    const now = this.pausedAt ?? Date.now();
    if (this.elapsedInSeg < 3 && this.idx > 0) this.idx--;
    this.segStart = now;
    this.onTick(this.view());
  }
  finish() {
    this.finished = true;
    beepDone();
    say('Session complete. Nice work.');
    this.cleanup();
    this.onTick(this.view());
    this.onDone(this.view());
  }
  stop() { this.cleanup(); }
  cleanup() {
    clearInterval(this.interval);
    this.running = false;
    document.removeEventListener('visibilitychange', this.onVis);
    releaseScreen();
  }
}
