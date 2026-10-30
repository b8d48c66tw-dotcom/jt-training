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
const musicMode = () => state.settings.musicMode !== false;

// How the app's sounds share the phone's audio:
//  music mode   - 'transient': short sounds that dip (duck) your music, e.g. Spotify, then let it come back up.
//                 Falls back to 'ambient' (plays over the music without dipping) where not supported.
//  normal mode  - 'playback': plays through the silent switch, but pauses other music.
export function setAudioMode() {
  const s = navigator.audioSession;
  if (!s) return;
  const wanted = musicMode() ? ['transient', 'ambient'] : ['playback'];
  for (const type of wanted) {
    try { s.type = type; if (s.type === type) return; } catch (e) { /* try the next one */ }
  }
}
function ctx() {
  if (!audio) {
    setAudioMode();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
  }
  if (audio && audio.state !== 'running') audio.resume().catch(() => {});
  return audio;
}
// In music mode the audio is switched off between cues so the phone lets your music come back up.
let busyUntil = 0;
let releaseTimer = null;
function release(endTime) {
  if (!audio || !musicMode()) return;
  busyUntil = Math.max(busyUntil, endTime);
  clearTimeout(releaseTimer);
  const wait = Math.max(0, busyUntil - audio.currentTime) * 1000 + 700;
  releaseTimer = setTimeout(() => {
    if (audio && audio.state === 'running' && audio.currentTime >= busyUntil - 0.02) audio.suspend().catch(() => {});
  }, wait);
}

// iPhone trick: a looping silent <audio> track puts the page in "media playback" mode, so
// chimes and voice play even with the silent switch on and on older iOS versions.
let silentEl = null;
function silentTrack() {
  if (silentEl) return silentEl;
  const n = 4000; // 0.5 sec of 8-bit silence at 8 kHz
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  silentEl = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
  silentEl.loop = true;
  silentEl.setAttribute('playsinline', '');
  return silentEl;
}
export function holdAudio(on) {
  if (on && musicMode()) return; // the silent track would pause your music
  try { if (on) silentTrack().play().catch(() => {}); else silentEl?.pause(); } catch (e) { /* ignore */ }
}
export function audioStatus() {
  return `audio ${audio ? audio.state : 'not started'}, voices ${window.speechSynthesis ? speechSynthesis.getVoices().length : 'none'}${navigator.audioSession ? ', iOS audio session ok' : ''}`;
}

// iPhone only allows audio and speech after a tap. Call this from any tap: it plays a silent
// sound and a silent word so later chimes and voice cues (fired by the timer) are allowed.
let unlocked = false;
export function unlockAudio() {
  const a = ctx();
  if (a) {
    try {
      const b = a.createBuffer(1, 1, 22050);
      const src = a.createBufferSource();
      src.buffer = b;
      src.connect(a.destination);
      src.start(0);
    } catch (e) { /* ignore */ }
  }
  if (!unlocked && window.speechSynthesis) {
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  // Briefly play the silent track so iPhone switches to media playback for this session.
  holdAudio(true);
  if (!timerHolding) setTimeout(() => { if (!timerHolding) holdAudio(false); }, 1500);
  unlocked = true;
}
let timerHolding = false;
// Soft chime: a sine tone with a gentle attack, a quiet overtone and a long natural fade.
function chime(freq, when = 0, dur = 0.9, level = 1) {
  const a = ctx();
  if (!a) return;
  const vol = Math.max(0, Math.min(1, state.settings.timerVolume ?? 0.6)) * 0.9 * level;
  if (!vol) return;
  const t0 = a.currentTime + when;
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.linearRampToValueAtTime(vol, t0 + 0.015);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out.connect(a.destination);
  [[1, 1], [2, 0.18], [3, 0.05]].forEach(([mult, amp]) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    g.gain.value = amp;
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  });
  release(t0 + dur + 0.05);
}
// Countdown 3-2-1: a quiet, short tick.
export function beepShort() { if (state.settings.timerSound) chime(660, 0, 0.25, 0.45); }
// Step change: two soft rising notes.
export function beepChange() {
  if (state.settings.timerSound) { chime(784, 0, 0.8); chime(1047, 0.16, 1.0); }
  if (state.settings.timerVibrate) navigator.vibrate?.([200, 100, 200]);
}
// Session done: a gentle three-note arpeggio.
export function beepDone() {
  if (state.settings.timerSound) { chime(659, 0, 1.0); chime(784, 0.2, 1.0); chime(1047, 0.4, 1.6); }
  if (state.settings.timerVibrate) navigator.vibrate?.([300, 120, 300]);
}

// ---- voice -----------------------------------------------------------------------------------------
// Picks the most natural English voice on the device: a chosen one first, then Enhanced/Premium
// (downloaded) voices, preferring Australian, then British, then any English.
const NATURAL = /premium|enhanced|natural|neural|siri/i;
export function englishVoices() {
  if (!window.speechSynthesis) return [];
  return speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
}
export function pickVoice() {
  const voices = englishVoices();
  if (!voices.length) return null;
  const chosen = state.settings.timerVoiceName && voices.find((v) => v.name === state.settings.timerVoiceName);
  if (chosen) return chosen;
  const score = (v) => (NATURAL.test(v.name) ? 100 : 0) + (/en[-_]AU/i.test(v.lang) ? 20 : /en[-_]GB/i.test(v.lang) ? 10 : 0) + (v.localService ? 5 : 0)
    + (/karen|catherine|lee|serena|kate|daniel|samantha/i.test(v.name) ? 3 : 0);
  return [...voices].sort((x, y) => score(y) - score(x))[0];
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {}; // voices load lazily on some phones

export function say(text, force = false) {
  if ((!state.settings.timerVoice && !force) || !window.speechSynthesis) return;
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/ - tap Next when done/i, '').replace(/Get ready: /, 'Next up, '));
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-AU';
    u.rate = 0.92;
    u.pitch = 1;
    u.volume = Math.max(0.2, Math.min(1, (state.settings.timerVolume ?? 0.5) + 0.3));
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

// ---- recorded voice clips -------------------------------------------------------------------------
// Clips live in voice/<key>.wav (key = clipKey of the phrase). Anything without a clip falls back
// to the device's speech voice.
export const clipKey = (t) => String(t).replace(/ - tap Next when done/i, '').replace(/\s*\([^)]*\)/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const numWord = (n) => WORDS[n] || String(n);
let clipList = null;
const clipBuffers = new Map();
let playing = [];
let playToken = 0;
async function loadClipList() {
  if (!clipList) {
    try { clipList = new Set(await (await fetch('voice/list.json')).json()); } catch (e) { clipList = new Set(); }
  }
  return clipList;
}
function clipBuffer(k) {
  if (!clipBuffers.has(k)) {
    const a = ctx();
    clipBuffers.set(k, fetch(`voice/${k}.wav`).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => a.decodeAudioData(b, res, rej))).catch(() => { clipBuffers.delete(k); return null; }));
  }
  return clipBuffers.get(k);
}
export async function preloadClips(phrases) {
  const list = await loadClipList();
  for (const k of new Set(phrases.map(clipKey))) if (list.has(k)) clipBuffer(k);
}
// Speaks a sequence of phrases, e.g. ['Next up', 'Goblet squat']. Interrupts anything still talking.
export async function speakParts(parts, force = false) {
  if ((!state.settings.timerVoice && !force) || !parts.length) return;
  const my = ++playToken;
  const list = await loadClipList();
  const keys = parts.map(clipKey);
  const a = ctx();
  if (!a || !keys.every((k) => list.has(k))) return say(parts.join(' '), force);
  const bufs = await Promise.all(keys.map(clipBuffer));
  if (my !== playToken) return;
  if (bufs.some((b) => !b)) return say(parts.join(' '), force);
  playing.forEach((src) => { try { src.stop(); } catch (e) { /* ignore */ } });
  playing = [];
  if (a.state !== 'running') await a.resume().catch(() => {});
  const g = a.createGain();
  g.gain.value = Math.max(0.3, Math.min(1, (state.settings.timerVolume ?? 0.6) + 0.35));
  g.connect(a.destination);
  let t = a.currentTime + 0.03;
  for (const b of bufs) {
    const src = a.createBufferSource();
    src.buffer = b;
    src.connect(g);
    src.start(t);
    playing.push(src);
    t += b.duration + 0.05;
  }
  release(t);
}

// What to say when a step starts.
export function cueFor(segs, idx) {
  const s = segs[idx];
  if (!s) return [];
  const name = (s.l || '').replace(/^Get ready: /, '');
  if (s.k === 'ready' && /^Get ready: /.test(s.l)) {
    // First exercise of a new round: say which round.
    const firstOfRound = s.round > 1 && !segs.slice(0, idx).some((x) => x.k === 'ready' && x.round === s.round);
    const lead = firstOfRound ? (s.round === s.rounds ? ['Last round'] : ['Round', numWord(s.round), 'of', numWord(s.rounds)]) : [];
    return [...lead, 'Next up', name];
  }
  if (s.k === 'work') return [name, ...(/^Left side/.test(s.sub || '') ? ['Left side'] : /^Right side/.test(s.sub || '') ? ['Right side'] : [])];
  if (s.k === 'switch') return ['Switch sides'];
  if (s.k === 'rest' && /^Round rest/.test(s.l)) return ['Round rest'];
  if (s.k === 'hold' && / - (left|right)$/.test(s.l)) return [s.l.replace(/ - (left|right)$/, ''), / - left$/.test(s.l) ? 'Left side' : 'Right side'];
  return [s.l];
}
// Steps that are recoveries get the longer countdown and spoken "three, two, one".
const RECOVERY = ['rest', 'ready', 'walk', 'jog', 'switch'];

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
    timerHolding = true;
    unlockAudio(); // unlock audio and speech on the user's tap
    const now = Date.now();
    this.startedAt = now;
    this.segStart = now;
    this.running = true;
    lockScreen();
    document.addEventListener('visibilitychange', this.onVis);
    preloadClips([...this.segs.flatMap((_, i) => cueFor(this.segs, i)), 'Ten seconds', 'Three', 'Two', 'One', 'Session complete']);
    this.announce();
    this.interval = setInterval(() => this.tick(), 200);
    this.tick();
  }
  announce() {
    speakParts(cueFor(this.segs, this.idx));
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
        const recovery = RECOVERY.includes(s.k);
        const from = recovery ? Math.min(5, s.s - 1) : 3;
        if (left <= from && left >= 1 && this.lastBeep !== `${this.idx}:${left}`) {
          this.lastBeep = `${this.idx}:${left}`;
          beepShort();
          if (recovery && left <= 3 && s.s >= 8) speakParts([numWord(left)]);
        }
        if (recovery && s.s >= 30 && left === 10 && this.lastTen !== this.idx) {
          this.lastTen = this.idx;
          const next = this.segs[this.idx + 1];
          const nextName = next && (next.l || '').replace(/^Get ready: /, '');
          speakParts(next && !['rest', 'ready'].includes(next.k) && nextName ? ['Ten seconds', 'Next up', nextName] : ['Ten seconds']);
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
    speakParts(['Session complete']);
    this.cleanup();
    this.onTick(this.view());
    this.onDone(this.view());
  }
  stop() { this.cleanup(); }
  cleanup() {
    timerHolding = false;
    holdAudio(false);
    clearInterval(this.interval);
    this.running = false;
    document.removeEventListener('visibilitychange', this.onVis);
    releaseScreen();
  }
}
