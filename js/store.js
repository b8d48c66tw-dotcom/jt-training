// Local storage: IndexedDB with a localStorage mirror as a fallback.
import { buildInitialState } from './seed.js';

const DB_NAME = 'jt-training';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'jt-training-state';

let db = null;
export let state = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet() {
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(KEY);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function idbPut(value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadState() {
  let loaded = null;
  try {
    db = await openDb();
    loaded = await idbGet();
  } catch (e) {
    console.warn('IndexedDB unavailable, using localStorage', e);
  }
  if (!loaded) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }
  state = loaded ? migrate(loaded) : buildInitialState();
  if (!loaded) await saveState();
  try { navigator.storage?.persist?.(); } catch (e) { /* ignore */ }
  return state;
}

// Keep older backups loadable as the data model grows.
function migrate(s) {
  const fresh = buildInitialState();
  for (const k of Object.keys(fresh)) if (s[k] === undefined) s[k] = fresh[k];
  for (const k of Object.keys(fresh.settings)) if (s.settings[k] === undefined) s.settings[k] = fresh.settings[k];
  for (const k of Object.keys(fresh.program)) if (s.program[k] === undefined) s.program[k] = fresh.program[k];
  // v2: the program now starts Wednesday 28 October 2026 (was Monday 26 October).
  if ((s.seedVersion || 1) < 2 && s.settings.startDate === '2026-10-26') {
    s.settings.startDate = fresh.settings.startDate;
    s.settings.endDate = fresh.settings.endDate;
    s.program.weeks.forEach((w, i) => { if (fresh.program.weeks[i]) w.start = fresh.program.weeks[i].start; });
    s.program.phases = fresh.program.phases;
    const before = (id) => id.slice(0, 10) < fresh.settings.startDate;
    for (const id of Object.keys(s.moves || {})) if (before(id)) delete s.moves[id];
    for (const id of Object.keys(s.skips || {})) if (before(id)) delete s.skips[id];
    for (const a of s.activities) if (a.planId && before(a.planId)) a.planId = null;
  }
  s.seedVersion = Math.max(s.seedVersion || 1, fresh.seedVersion);
  return s;
}

let saveTimer = null;
export function saveState() {
  clearTimeout(saveTimer);
  return new Promise((resolve) => {
    saveTimer = setTimeout(async () => {
      const plain = JSON.parse(JSON.stringify(state));
      try { if (db) await idbPut(plain); } catch (e) { console.warn('IDB save failed', e); }
      try { localStorage.setItem(LS_KEY, JSON.stringify(plain)); } catch (e) { /* quota */ }
      resolve();
    }, 120);
  });
}

export function replaceState(next) {
  state = migrate(next);
  return saveState();
}

export function resetState() {
  state = buildInitialState();
  return saveState();
}

// ---- day records --------------------------------------------------------------
export function day(iso) {
  if (!state.days[iso]) state.days[iso] = { weight: null, mobility: false, n: {}, kcal: null, proteinG: null };
  return state.days[iso];
}
export function peekDay(iso) {
  return state.days[iso] || null;
}
