// Session detail and log forms. Used for planned sessions, ad-hoc logs and editing.
import { state } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, card, pill, scale, field, formData, commit, toast, go, openTimer } from '../core.js';

const RUN_KINDS = { easy: 'Easy', runwalk: 'Run/walk', long: 'Long easy', tempo: 'Tempo or intervals', race: 'Race' };

// ---- strength ----------------------------------------------------------------------------
function strengthForm(ctx) {
  const { info, act, n, date } = ctx;
  const def = info.def;
  const exs = def.exercises.map((id) => P.exerciseById(id)).filter(Boolean);
  let html = `<div class="note">${U.esc(def.format)}</div>
    ${card(`<h3>Warm-up</h3><p>${U.esc(def.warmup)}</p>`, 'card-quiet')}`;
  html += exs.map((base, i) => {
    const ex = P.exerciseForWeek(base, n);
    const logged = act?.exercises?.[i];
    const chosen = logged?.name || ex.name;
    const options = [ex.name, ...(ex.baseName ? [ex.baseName] : []), ...(ex.swaps || [])];
    if (!options.includes(chosen)) options.unshift(chosen);
    const hist = P.exerciseHistory(chosen).filter((h) => h.date < date);
    const last = hist[hist.length - 1];
    const ready = P.readyToGoUp(ex, chosen, date);
    const weight = logged?.weight ?? (ready && last?.weight ? P.nextWeight(last.weight) ?? last.weight : last?.weight ?? '');
    const unitLbl = { reps: 'reps', each: 'each side', sec: 'sec', secEach: 'sec each', m: 'm' }[ex.unit];
    const rounds = Math.max(info.rounds, 4);
    let reps = '';
    for (let r = 0; r < rounds; r++) {
      const v = logged?.reps?.[r] ?? '';
      reps += `<input class="rep ${r >= info.rounds ? 'opt' : ''}" name="ex.${i}.r${r}" type="number" inputmode="numeric" value="${v}" placeholder="${r < info.rounds ? ex.max : '-'}" aria-label="Round ${r + 1} ${unitLbl}">`;
    }
    return card(`<div class="ex-head"><span class="ex-num">${i + 1}</span><div><div class="ex-name">${U.esc(ex.name)}</div><div class="muted">${U.esc(P.fmtTarget(ex))}</div></div></div>
      ${ready ? `<div class="badge-up">&#9650; Ready to go up - ${U.esc(ready.suggestion)}</div>` : ''}
      <div class="cue">${U.esc(ex.cue)}</div>
      <label class="field"><span class="lbl">Exercise (swap if needed)</span><select name="ex.${i}.name">${options.map((o) => `<option ${o === chosen ? 'selected' : ''}>${U.esc(o)}</option>`).join('')}</select></label>
      ${last ? `<div class="muted">Last time (${U.fmtDate(last.date)}): ${last.weight ? `${last.weight} kg x ` : ''}${last.reps.join(', ')}${last.effort ? ` - effort ${last.effort}` : ''}</div>` : ''}
      <div class="ex-row">
        ${ex.load ? `<label class="field w-kg"><span class="lbl">kg</span><input name="ex.${i}.weight" type="number" inputmode="decimal" step="0.5" value="${weight ?? ''}" placeholder="kg"></label>` : `<input type="hidden" name="ex.${i}.weight" value="">`}
        <div class="field"><span class="lbl">${U.esc(unitLbl)} per round</span><div class="reps">${reps}</div></div>
      </div>
      <button type="button" class="btn btn-sm" data-act="fill-reps" data-i="${i}" data-v="${ex.max}" data-n="${info.rounds}">All ${info.rounds} rounds at ${ex.max}</button>
      <input type="hidden" name="ex.${i}.id" value="${ex.id}"><input type="hidden" name="ex.${i}.unit" value="${ex.unit}">`, 'card-ex');
  }).join('');
  const fin = info.finisher;
  html += card(`<h3>Finisher</h3><p><b>${U.esc(fin.label)}</b></p>
    <button type="button" class="btn btn-lg btn-block" data-act="fin-timer">Start finisher timer</button>
    <label class="check"><input type="checkbox" name="finisherDone" ${act?.finisherDone || (!act && false) ? 'checked' : ''}> Finisher done</label>`);
  html += card(`${scale('effort', act?.effort, { label: 'Session effort (1 - 10). 6 or under with all reps at the top = go up next time.' })}
    <div class="row2">
      ${field('Duration (min)', `<input name="durationMin" type="number" inputmode="numeric" value="${act?.durationSec ? Math.round(act.durationSec / 60) : ''}" placeholder="${info.minutes}">`)}
      ${field('Avg HR', `<input name="avgHr" type="number" inputmode="numeric" value="${act?.avgHr ?? ''}">`)}
    </div>
    ${field('Notes', `<textarea name="notes" rows="2">${U.esc(act?.notes || '')}</textarea>`)}`);
  return html;
}
on('fill-reps', (el) => {
  const form = el.closest('form');
  for (let r = 0; r < Number(el.dataset.n); r++) {
    const inp = form.elements[`ex.${el.dataset.i}.r${r}`];
    if (inp) inp.value = el.dataset.v;
  }
});
on('fin-timer', () => {
  const { info, item } = ui.sessionCtx;
  openTimer({ title: info.finisher.label, segments: info.finisher.segments, planId: item?.id });
});

function readStrength(f, ctx) {
  const exercises = [];
  const exCount = ctx.info.def.exercises.length;
  let rounds = 0;
  for (let i = 0; i < exCount; i++) {
    const reps = [];
    for (let r = 0; r < 6; r++) {
      if (!(`ex.${i}.r${r}` in f)) break;
      reps.push(U.num(f[`ex.${i}.r${r}`]));
    }
    while (reps.length && reps[reps.length - 1] == null) reps.pop();
    rounds = Math.max(rounds, reps.length);
    exercises.push({ id: f[`ex.${i}.id`], name: f[`ex.${i}.name`], weight: U.num(f[`ex.${i}.weight`]), reps, unit: f[`ex.${i}.unit`] });
  }
  return {
    type: 'strength', title: ctx.info.title, sessionKey: ctx.key, exercises, rounds,
    effort: U.num(f.effort), finisherDone: !!f.finisherDone, finisher: ctx.info.finisher.label,
    durationSec: f.durationMin ? U.num(f.durationMin) * 60 : null, avgHr: U.num(f.avgHr), notes: f.notes || '',
  };
}

// ---- run ------------------------------------------------------------------------------------
function runForm(ctx) {
  const { info, act, item } = ctx;
  const s = state.settings;
  let html = '';
  if (info.run) {
    const run = info.run;
    html += card(`<h3>${U.esc(run.title)}</h3>
      <div class="targets">
        <span>HR cap <b>${s.hrCapLow} - ${s.hrCapHigh} bpm</b></span>
        <span>Easy pace <b>${U.esc(s.easyPace)}</b></span>
        ${run.kind === 'tempo' ? `<span>Tempo <b>${U.esc(s.tempoPace)}</b></span>` : ''}
        ${run.km ? `<span>Distance <b>${run.km} km</b></span>` : ''}
        <span>About <b>${run.minutes} min</b></span>
      </div>
      <p class="muted">Easy means under the HR cap. Walking to stay under it is fine. Tempo means comfortably hard.</p>
      <button type="button" class="btn btn-xl btn-go btn-block" data-act="run-timer">Start interval timer</button>`);
    if (ctx.key === 'tueRun') {
      const drills = state.program.tueMobility.map((id) => state.program.mobility.find((m) => m.id === id)).filter(Boolean);
      html += card(`<h3>After the run: 5 min calf and hip mobility</h3><ul class="drills">${drills.map((m) => `<li><b>${U.esc(m.name)}</b> <span class="muted">${m.sides === 2 ? `${m.hold} sec each side` : `${m.hold} sec`}</span><div class="cue">${U.esc(m.cue)}</div></li>`).join('')}</ul>`, 'card-quiet');
    }
  }
  const timerSec = ui.timerResult && ui.timerResult.planId === (item?.id ?? null) ? ui.timerResult.sec : null;
  const dur = act?.durationSec ?? timerSec;
  const kind = act?.runKind || info.run?.kind || 'easy';
  html += card(`<h3>Log the run</h3>
    <div class="row2">
      ${field('Distance (km)', `<input name="distanceKm" type="number" inputmode="decimal" step="0.01" value="${act?.distanceKm ?? ''}" data-change="pace" data-input="pace">`)}
      ${field('Total time', `<input name="time" type="text" inputmode="numeric" placeholder="mm:ss" value="${dur ? U.fmtDuration(dur) : ''}" data-change="pace" data-input="pace">`, 'mm:ss or h:mm:ss')}
    </div>
    <div class="row2">
      ${field('Avg HR (bpm)', `<input name="avgHr" type="number" inputmode="numeric" value="${act?.avgHr ?? ''}">`)}
      <div class="field"><span class="lbl">Avg pace</span><div class="pace-out" id="pace-out">${act ? U.fmtPace(U.paceSec(act.distanceKm, act.durationSec)) : '-'}</div></div>
    </div>
    ${field('Type', `<select name="runKind">${Object.entries(RUN_KINDS).map(([k, v]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
    ${scale('felt', act?.felt, { label: 'How it felt (1 = very easy, 10 = flat out)' })}
    ${field('Notes', `<textarea name="notes" rows="2">${U.esc(act?.notes || '')}</textarea>`)}`);
  return html;
}
on('pace', (el) => {
  const f = el.closest('form');
  const km = U.num(f.distanceKm.value);
  const sec = U.parseDuration(f.time.value);
  document.getElementById('pace-out').textContent = U.fmtPace(U.paceSec(km, sec));
});
on('run-timer', () => {
  const { info, item } = ui.sessionCtx;
  openTimer({ title: info.run.title, segments: info.run.segments, planId: item?.id ?? null, onDoneHash: location.hash });
});
function readRun(f, ctx) {
  return {
    type: 'run', title: ctx.info.run ? `${ctx.info.title}: ${ctx.info.run.title}` : 'Run', sessionKey: ctx.key,
    distanceKm: U.num(f.distanceKm), durationSec: U.parseDuration(f.time), avgHr: U.num(f.avgHr),
    runKind: f.runKind, felt: U.num(f.felt), notes: f.notes || '',
  };
}

// ---- cardio, cricket, other ---------------------------------------------------------------------
function cardioForm(ctx) {
  const { act } = ctx;
  const floatInfo = ctx.key === 'floating' ? card(`<p>${U.esc(state.program.floating.options)}</p><a class="btn btn-block" href="#/day/${ctx.date}">Mobility flow for today</a>`, 'card-quiet') : '';
  return floatInfo + card(`<h3>Log easy cardio</h3>
    ${field('Machine', `<select name="machine">${['BikeErg', 'RowErg', 'Walk', 'Other'].map((m) => `<option ${act?.machine === m ? 'selected' : ''}>${m}</option>`).join('')}</select>`)}
    <div class="row2">
      ${field('Minutes', `<input name="durationMin" type="number" inputmode="numeric" value="${act?.durationSec ? Math.round(act.durationSec / 60) : ''}" placeholder="20">`)}
      ${field('Distance (m)', `<input name="distanceM" type="number" inputmode="numeric" value="${act?.distanceM ?? ''}">`)}
    </div>
    ${field('Avg HR', `<input name="avgHr" type="number" inputmode="numeric" value="${act?.avgHr ?? ''}">`)}
    ${scale('felt', act?.felt, { label: 'How it felt (1 - 10)' })}
    ${field('Notes', `<textarea name="notes" rows="2">${U.esc(act?.notes || '')}</textarea>`)}`);
}
const readCardio = (f, ctx) => ({
  type: 'cardio', title: `${f.machine}${ctx.key === 'floating' ? ' (floating day)' : ''}`, sessionKey: ctx.key, machine: f.machine,
  durationSec: f.durationMin ? U.num(f.durationMin) * 60 : null, distanceM: U.num(f.distanceM), avgHr: U.num(f.avgHr), felt: U.num(f.felt), notes: f.notes || '',
});

function cricketForm(ctx) {
  const { act } = ctx;
  const kind = act?.cricketKind || (ctx.key === 'cricketGame' ? 'game' : 'training');
  const hrs = act?.durationSec ? Math.floor(act.durationSec / 3600) : '';
  const mins = act?.durationSec ? Math.round((act.durationSec % 3600) / 60) : '';
  const tips = kind === 'game' ? state.nutrition.cricketGame : state.nutrition.cricketTraining;
  return card(`<h3>Fuelling</h3><ul class="plain">${tips.map((t) => `<li>${U.esc(t)}</li>`).join('')}</ul>`, 'card-quiet') + card(`<h3>Log cricket</h3>
    ${field('Type', `<select name="cricketKind"><option value="training" ${kind === 'training' ? 'selected' : ''}>Training</option><option value="game" ${kind === 'game' ? 'selected' : ''}>Game</option></select>`)}
    <div class="row2">
      ${field('Hours', `<input name="hrs" type="number" inputmode="numeric" value="${hrs}" placeholder="${kind === 'game' ? 6 : 2}">`)}
      ${field('Minutes', `<input name="mins" type="number" inputmode="numeric" value="${mins}" placeholder="0">`)}
    </div>
    ${scale('effort', act?.effort, { label: 'Effort (1 - 10)' })}
    ${field('Notes', `<textarea name="notes" rows="2" placeholder="Runs, overs, how the body felt">${U.esc(act?.notes || '')}</textarea>`)}`);
}
const readCricket = (f, ctx) => ({
  type: 'cricket', title: f.cricketKind === 'game' ? 'Cricket game' : 'Cricket training', sessionKey: ctx.key, cricketKind: f.cricketKind,
  durationSec: ((U.num(f.hrs) || 0) * 3600 + (U.num(f.mins) || 0) * 60) || null, effort: U.num(f.effort), notes: f.notes || '',
});

function otherForm(ctx) {
  const { act } = ctx;
  return card(`<h3>Log other activity</h3>
    ${field('What', `<input name="title" type="text" value="${U.esc(act?.title || '')}" placeholder="e.g. Walk, swim, yoga">`)}
    ${field('Minutes', `<input name="durationMin" type="number" inputmode="numeric" value="${act?.durationSec ? Math.round(act.durationSec / 60) : ''}">`)}
    ${scale('felt', act?.felt, { label: 'Effort (1 - 10)' })}
    ${field('Notes', `<textarea name="notes" rows="2">${U.esc(act?.notes || '')}</textarea>`)}`);
}
const readOther = (f) => ({ type: 'other', title: f.title || 'Other', durationSec: f.durationMin ? U.num(f.durationMin) * 60 : null, felt: U.num(f.felt), notes: f.notes || '' });

const FORMS = {
  strength: [strengthForm, readStrength], run: [runForm, readRun], cardio: [cardioForm, readCardio],
  cricket: [cricketForm, readCricket], other: [otherForm, readOther], floating: [cardioForm, readCardio],
};

// ---- screen --------------------------------------------------------------------------------------
function renderForm(ctx, heading) {
  ui.sessionCtx = ctx;
  const type = ctx.type;
  const [form] = FORMS[type];
  const act = ctx.act;
  let html = heading;
  html += `<form class="log-form" data-submit="save-log">
    ${!ctx.item || act ? field('Date', `<input name="date" type="date" value="${act?.date || ctx.date}">`) : `<input type="hidden" name="date" value="${ctx.date}">`}
    ${act?.source === 'strava' ? '<div class="note">Imported from Strava.</div>' : ''}
    ${form(ctx)}
    <button class="btn btn-primary btn-xl btn-block">${act ? 'Save changes' : 'Save log'}</button>
  </form>`;
  if (act) html += `<button class="btn btn-danger btn-block" data-act="del-log" data-id="${act.id}">Delete this log</button>`;
  return html;
}

on('save-log', (form) => {
  const ctx = ui.sessionCtx;
  const f = formData(form);
  const [, read] = FORMS[ctx.type];
  const data = read(f, ctx);
  if (data.type === 'run' && (!data.distanceKm || !data.durationSec)) return toast('Enter distance and time');
  const base = ctx.act || { id: U.uid(), source: 'manual', externalId: null, created: new Date().toISOString() };
  const rec = { ...base, ...data, date: f.date || ctx.date, planId: ctx.act ? ctx.act.planId : ctx.item?.id ?? null };
  const idx = state.activities.findIndex((a) => a.id === rec.id);
  if (idx >= 0) state.activities[idx] = rec; else state.activities.push(rec);
  if (rec.planId) delete state.skips[rec.planId];
  ui.timerResult = null;
  toast('Saved');
  commit(false);
  go(ctx.item ? '#/today' : '#/log');
});
on('del-log', (el) => {
  if (!confirm('Delete this log? This cannot be undone (unless you restore a backup).')) return;
  state.activities = state.activities.filter((a) => a.id !== el.dataset.id);
  commit(false);
  go('#/log');
});

export function renderSession(planId) {
  const item = P.findItem(planId);
  if (!item.week) return { title: 'Session', html: '<p>Session not found.</p>' };
  const info = P.sessionInfo(item.key, item.week);
  const act = P.activityFor(planId);
  const status = P.statusOf(item);
  const type = info.type === 'floating' ? 'floating' : info.type;
  const ctx = { item, info, act, n: item.week, date: item.date, key: item.key, type };
  let heading = `<div class="sess-hero s-${info.type}"><div class="muted">${U.dayName(item.date)} ${U.fmtDate(item.date)} - Week ${item.week}${item.movedFrom ? ` - moved from ${U.dayShort(item.movedFrom)}` : ''}</div>
    <div class="h1">${U.esc(info.title)}</div><div>${U.esc(info.subtitle)}</div><div class="hero-pill">${pill(status)}</div></div>`;
  if (type === 'floating') {
    const missed = P.missedThisWeek().filter((m) => P.freeDays(m).includes(item.date));
    if (missed.length) {
      heading += card(`<h3>Make-up option</h3>${missed.map((m) => `<button class="btn btn-primary btn-block" data-act="move" data-id="${m.id}" data-to="${item.date}">Do ${U.esc(P.sessionInfo(m.key, m.week).title)} here instead</button>`).join('')}<p class="muted">Day before a game - keep it light (drop a round if you need to).</p>`);
    }
  }
  return { title: info.title, html: renderForm(ctx, heading) };
}

export function renderNewLog(kind) {
  const n = P.currentWeek();
  const date = U.today();
  let ctx;
  if (kind === 'strengthA' || kind === 'strengthB') ctx = { info: P.sessionInfo(kind, n), n, date, key: kind, type: 'strength' };
  else if (kind === 'run') ctx = { info: { title: 'Run' }, n, date, key: null, type: 'run' };
  else if (kind === 'cricket') ctx = { info: { title: 'Cricket' }, n, date, key: U.dow(date) === 6 ? 'cricketGame' : 'cricketTraining', type: 'cricket' };
  else if (kind === 'cardio') ctx = { info: { title: 'Cardio' }, n, date, key: null, type: 'cardio' };
  else ctx = { info: { title: 'Other' }, n, date, key: null, type: 'other' };
  const titles = { strengthA: 'Log Strength A', strengthB: 'Log Strength B', run: 'Log a run', cricket: 'Log cricket', cardio: 'Log cardio', other: 'Log other' };
  return { title: titles[kind] || 'Log', html: renderForm(ctx, '') };
}

export function renderActivity(id) {
  const act = state.activities.find((a) => a.id === id);
  if (!act) return { title: 'Log', html: '<p>Not found.</p>' };
  if (act.planId) {
    const item = P.findItem(act.planId);
    if (item.week) return renderSession(act.planId);
  }
  const n = P.weekNum(act.date) || P.currentWeek();
  let ctx;
  if (act.type === 'strength') ctx = { info: P.sessionInfo(act.sessionKey || 'strengthA', n), n, date: act.date, key: act.sessionKey || 'strengthA', type: 'strength', act };
  else ctx = { info: { title: act.title }, n, date: act.date, key: act.sessionKey || null, type: act.type in FORMS ? act.type : 'other', act };
  return { title: act.title, html: renderForm(ctx, '') };
}
