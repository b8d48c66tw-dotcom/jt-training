// Strava connection: OAuth in the browser, token refresh, and activity sync.
// Your Strava API app's Client ID and Secret are stored on this device only.
import { state, saveState } from './store.js';
import * as P from './plan.js';
import * as U from './util.js';

const AUTH_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const API = 'https://www.strava.com/api/v3';

export const sv = () => {
  if (!state.settings.strava) state.settings.strava = {};
  return state.settings.strava;
};
export const isConfigured = () => !!(sv().clientId && sv().clientSecret);
export const isConnected = () => !!sv().refreshToken;
export const redirectUri = () => location.origin + location.pathname;

export function startConnect() {
  const s = sv();
  s.oauthState = U.uid();
  saveState();
  const q = new URLSearchParams({
    client_id: s.clientId, redirect_uri: redirectUri(), response_type: 'code',
    approval_prompt: 'auto', scope: 'read,activity:read_all', state: s.oauthState,
  });
  // Small delay so the save lands before we leave the page.
  setTimeout(() => { location.href = `${AUTH_URL}?${q}`; }, 250);
}

async function tokenRequest(params) {
  const s = sv();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: s.clientId, client_secret: s.clientSecret, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Strava said ${res.status}`);
  s.accessToken = data.access_token;
  s.refreshToken = data.refresh_token;
  s.expiresAt = data.expires_at;
  if (data.athlete) s.athlete = `${data.athlete.firstname || ''} ${data.athlete.lastname || ''}`.trim();
  await saveState();
  return data;
}

export async function exchangeCode(code) {
  await tokenRequest({ code, grant_type: 'authorization_code' });
}

async function accessToken() {
  const s = sv();
  if (!s.refreshToken) throw new Error('Not connected to Strava');
  if (!s.accessToken || !s.expiresAt || s.expiresAt - 120 < Date.now() / 1000) {
    await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refreshToken });
  }
  return s.accessToken;
}

export function disconnect() {
  const s = sv();
  const token = s.accessToken;
  if (token) fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  delete s.accessToken; delete s.refreshToken; delete s.expiresAt; delete s.athlete;
  return saveState();
}

// If the page was opened by Strava's redirect, finish connecting.
// Returns { handled, ok, message, code } so the UI can show the right thing.
export async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return { handled: false };
  const clean = () => history.replaceState(null, '', location.pathname + '#/settings');
  if (q.get('error')) { clean(); return { handled: true, ok: false, message: 'Strava access was not granted.' }; }
  const code = q.get('code');
  if (!isConfigured()) {
    // Usually means the redirect opened in Safari instead of the installed app.
    clean();
    return { handled: true, ok: false, code };
  }
  try {
    await exchangeCode(code);
    clean();
    const r = await sync();
    return { handled: true, ok: true, message: `Connected to Strava. ${r.added} new, ${r.updated} updated.` };
  } catch (e) {
    clean();
    return { handled: true, ok: false, message: `Could not connect: ${e.message}` };
  }
}

// ---- sync --------------------------------------------------------------------------------------
const RUN = ['Run', 'TrailRun', 'VirtualRun'];
const STRENGTH = ['WeightTraining', 'Workout', 'HighIntensityIntervalTraining', 'Crossfit'];
const CARDIO = ['Ride', 'VirtualRide', 'Rowing', 'VirtualRow', 'Elliptical', 'StairStepper', 'Swim'];

function classify(a) {
  const sport = a.sport_type || a.type;
  if (sport === 'Cricket' || /cricket/i.test(a.name || '')) return 'cricket';
  if (RUN.includes(sport)) return 'run';
  if (STRENGTH.includes(sport)) return 'strength';
  if (CARDIO.includes(sport)) return 'cardio';
  return null; // walks, hikes and anything else are skipped
}

// The open planned item on that date this activity should count towards.
function planFor(date, type) {
  const want = {
    run: ['tueRun', 'sunRun'], strength: ['strengthA', 'strengthB'],
    cricket: ['cricketGame', 'cricketTraining'], cardio: ['floating'],
  }[type] || [];
  return P.itemsOn(date).find((i) => want.includes(i.key) && !state.activities.some((x) => x.planId === i.id && x.externalId)) || null;
}

function fromStrava(a, type) {
  const date = (a.start_date_local || '').slice(0, 10);
  const base = {
    date, title: a.name, source: 'strava', externalId: String(a.id),
    durationSec: a.moving_time || a.elapsed_time || null,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
  };
  if (type === 'run') return { ...base, type: 'run', distanceKm: Math.round((a.distance || 0) / 10) / 100 };
  if (type === 'cricket') return { ...base, type: 'cricket', durationSec: a.elapsed_time || a.moving_time, cricketKind: U.dow(date) === 6 ? 'game' : 'training' };
  if (type === 'cardio') return { ...base, type: 'cardio', machine: /row/i.test(a.sport_type) ? 'RowErg' : /ride/i.test(a.sport_type) ? 'BikeErg' : a.sport_type, distanceM: a.distance ? Math.round(a.distance) : null };
  return { ...base, type: 'strength', exercises: [], rounds: 0 };
}

export async function sync() {
  const s = sv();
  const token = await accessToken();
  const programStart = U.parse(state.settings.startDate).getTime() / 1000;
  const after = Math.floor(Math.max(programStart, (s.lastSyncEpoch || 0) - 3 * 86400));
  let page = 1, all = [];
  while (page <= 5) {
    const res = await fetch(`${API}/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) throw new Error('Strava rate limit hit - try again in 15 minutes');
    if (!res.ok) throw new Error(`Strava said ${res.status}`);
    const batch = await res.json();
    all = all.concat(batch);
    if (batch.length < 100) break;
    page++;
  }
  // Oldest first, and strength before cardio on the same day so finishers attach to the gym session.
  const rank = (a) => (classify(a) === 'cardio' ? 1 : 0);
  all.sort((x, y) => (x.start_date_local || '').slice(0, 10).localeCompare((y.start_date_local || '').slice(0, 10)) || rank(x) - rank(y));
  let added = 0, updated = 0;
  for (const a of all) {
    const type = classify(a);
    if (!type) continue;
    const ext = String(a.id);
    const data = fromStrava(a, type);
    if (state.activities.some((x) => (x.linkedExternalIds || []).includes(ext))) continue;
    const existing = state.activities.find((x) => x.externalId === ext);
    if (existing) {
      // Refresh Strava numbers, keep anything you typed (exercises, felt, notes).
      for (const k of ['durationSec', 'avgHr', 'distanceKm', 'distanceM']) if (data[k] != null) existing[k] = data[k];
      updated++;
      continue;
    }
    const plan = planFor(data.date, type);
    const manual = plan && state.activities.find((x) => x.planId === plan.id && !x.externalId);
    if (manual) {
      // You already logged it by hand: attach Strava's numbers to your log.
      manual.externalId = ext;
      manual.stravaTitle = a.name;
      if (data.avgHr) manual.avgHr = data.avgHr;
      if (type === 'run') { manual.distanceKm = data.distanceKm; manual.durationSec = data.durationSec; }
      else if (!manual.durationSec) manual.durationSec = data.durationSec;
      updated++;
      continue;
    }
    // Strength and cardio on a strength day are usually the warm-up or finisher: attach, don't duplicate.
    if (type === 'cardio') {
      const strengthLog = state.activities.find((x) => x.date === data.date && x.type === 'strength');
      if (strengthLog) {
        strengthLog.finisherStrava = `${data.machine} ${Math.round((data.durationSec || 0) / 60)} min${data.avgHr ? `, ${data.avgHr} bpm` : ''}`;
        strengthLog.linkedExternalIds = [...(strengthLog.linkedExternalIds || []), ext];
        if (!strengthLog.finisherDone) strengthLog.finisherDone = true;
        updated++;
        continue;
      }
    }
    state.activities.push({
      id: U.uid(), ...data, planId: plan ? plan.id : null, sessionKey: plan ? plan.key : null,
      runKind: type === 'run' ? (plan ? P.sessionInfo(plan.key, plan.week).run?.kind : 'easy') || 'easy' : undefined,
      felt: null, effort: null, notes: '', created: new Date().toISOString(),
    });
    if (plan) delete state.skips[plan.id];
    added++;
  }
  s.lastSync = new Date().toISOString();
  s.lastSyncEpoch = Math.floor(Date.now() / 1000);
  await saveState();
  return { added, updated, fetched: all.length };
}

// Quiet sync when the app opens, at most once an hour.
export async function autoSync() {
  const s = sv();
  if (!isConnected() || s.autoSync === false || !navigator.onLine) return null;
  if (s.lastSyncEpoch && Date.now() / 1000 - s.lastSyncEpoch < 3600) return null;
  try { return await sync(); } catch (e) { console.warn('Strava auto-sync failed', e); return null; }
}
