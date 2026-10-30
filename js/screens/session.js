// Session detail and log forms. Used for planned sessions, ad-hoc logs and editing.
import { state } from '../store.js';
import * as P from '../plan.js';
import * as U from '../util.js';
import { on, ui, card, scale, field, formData, commit, toast, go, openTimer, flip } from '../core.js';
import { heroBg, pic } from '../visual.js';
import { primaryAction, movePanel } from './today.js';

const RUN_KINDS = { easy: 'Easy', runwalk: 'Run/walk', long: 'Long easy', tempo: 'Tempo or intervals', race: 'Race' };

// ---- strength ----------------------------------------------------------------------------
// The "start guided session" card: round options with how long each takes.
export function guidedCard(key, n, date, planId, hash) {
  const { opts, best, planned } = P.guidedOptions(key, n, date);
  const T = state.settings.timing;
  const w = P.week(n) || {};
  const rest = w.roundRest ?? T.roundRest;
  const btn = (o, primary) => `<button type="button" class="btn ${primary ? 'btn-primary btn-lg btn-block' : 'btn-sm'}" data-act="guided" data-key="${key}" data-n="${n}" data-date="${date}" data-r="${o.rounds}" data-c="${o.compress ? 1 : ''}" data-id="${planId || ''}" data-hash="${U.esc(hash)}">${primary ? `Start session - ${o.rounds} rounds, ${o.min} min` : `${o.rounds} rounds - ${o.min} min`}</button>`;
  return card(`<div class="kicker teal">Guided session</div>
    <p>Press start and the timer runs everything: a guided warm-up, ${T.work} sec sets (${T.sideWork} sec each side for single-side moves), ${T.transition} sec changeovers, ${rest} sec rest between rounds, the finisher and a cool-down.</p>
    ${w.effort ? `<p class="muted">${U.esc(w.effort)}.</p>` : ''}
    ${best.rounds < planned ? `<p class="muted">The plan says ${planned} rounds this week - ${best.rounds} fit${best.compress ? ' with shorter rests' : ''} in about ${T.sessionMinutes} min.</p>` : best.compress ? '<p class="muted">Rests are slightly shorter to fit the time.</p>' : ''}
    ${btn(best, true)}
    <div class="btn-row">${opts.filter((o) => o.rounds !== best.rounds || best.compress).map((o) => btn(o, false)).join('')}</div>`, 'card-guided');
}

function guidedSummary(g, date, n, names) {
  const exs = g.info.def.exercises.map((id) => P.exerciseById(id)).filter(Boolean).map((e) => P.exerciseForWeek(e, n));
  const T = state.settings.timing;
  return `<ul class="t-plan">
    <li><b>Warm-up</b> ${Math.round((g.info.def.warmupSteps?.reduce((a, x) => a + x.s, 0) || T.warmup) / 60)} min, guided</li>
    <li><b>${g.rounds} rounds</b> of ${exs.length} exercises${g.compress ? ' (shorter rests)' : ''}</li>
    ${exs.map((ex, i) => {
      const name = names?.[i] || ex.name;
      const kg = ex.load ? P.suggestedWeight(ex, name, date) : null;
      return `<li class="t-ex">${flip(P.imgFor(name), 'flip-xs') || '<div class="flip-xs flip-none"></div>'}<span>${U.esc(name)}<small>${U.esc(P.fmtTarget(ex))}${kg ? ` - ${kg} kg` : ''}</small></span></li>`;
    }).join('')}
    <li><b>Finisher</b> ${U.esc(g.info.finisher.label)}</li>
    <li><b>Cool-down</b> ${Math.round((g.compress ? Math.min(T.cooldown, 120) : T.cooldown) / 60)} min</li>
  </ul>`;
}

on('guided', (el) => {
  const d = el.dataset;
  const n = Number(d.n);
  // Use any swaps already chosen on the session screen.
  const form = el.closest('main')?.querySelector('form.log-form');
  const names = form ? [...form.querySelectorAll('select[name$=".name"]')].map((s) => s.value) : null;
  const g = P.guidedStrength(d.key, n, Number(d.r), d.date, !!d.c, names);
  openTimer({ title: `${g.info.title} - ${g.rounds} rounds`, segments: g.segs, planId: d.id || null, onDoneHash: d.hash || location.hash, summary: guidedSummary(g, d.date, n, names), meta: { names, guided: true, key: d.key, n, date: d.date } });
});
on('ex-swap', (el) => {
  const slot = el.closest('.card-ex')?.querySelector('.flip-slot');
  if (slot) slot.innerHTML = flip(P.imgFor(el.value));
});

function strengthForm(ctx) {
  const { info, act, n, date } = ctx;
  const def = info.def;
  const exs = def.exercises.map((id) => P.exerciseById(id)).filter(Boolean);
  // Coming back from a guided session: pre-fill the rounds you completed at the top of the range.
  const tr = !act && ui.timerResult && ui.timerResult.planId === (ctx.item?.id ?? null) && ui.timerResult.rounds != null ? ui.timerResult : null;
  let html = '';
  if (tr) html += `<div class="note note-good">Filled in from your guided session: ${tr.rounds} round${tr.rounds === 1 ? '' : 's'} at the top of the rep range. Change any you missed, add the weights you used and your effort, then save.</div>`;
  else if (!act && !ctx.preview) html += guidedCard(ctx.key, n, date, ctx.item?.id, location.hash);
  html += `<div class="note">${U.esc(def.format)}</div>
    ${card(`<h3>Warm-up</h3><p>${U.esc(def.warmup)}</p>`, 'card-quiet')}`;
  html += exs.map((base, i) => {
    const ex = P.exerciseForWeek(base, n);
    const logged = act?.exercises?.[i];
    const chosen = logged?.name || tr?.names?.[i] || ex.name;
    const options = [ex.name, ...(ex.baseName ? [ex.baseName] : []), ...(ex.swaps || [])];
    if (!options.includes(chosen)) options.unshift(chosen);
    const hist = P.exerciseHistory(chosen).filter((h) => h.date < date);
    const last = hist[hist.length - 1];
    const ready = P.readyToGoUp(ex, chosen, date);
    const trKg = tr?.sets ? Object.entries(tr.sets).filter(([k]) => k.startsWith(`${i}:`)).map(([, v]) => v.kg).filter((x) => x != null).pop() : null;
    const weight = logged?.weight ?? trKg ?? (ready && last?.weight ? P.nextWeight(last.weight) ?? last.weight : last?.weight ?? '');
    const unitLbl = { reps: 'reps', each: 'each side', sec: 'sec', secEach: 'sec each', m: 'm' }[ex.unit];
    const rounds = Math.max(info.rounds, 4);
    let reps = '';
    for (let r = 0; r < rounds; r++) {
      const v = logged?.reps?.[r] ?? (tr?.sets?.[`${i}:${r + 1}`]?.reps ?? (tr && r < tr.rounds ? ex.max : ''));
      reps += `<input class="rep ${r >= info.rounds ? 'opt' : ''}" name="ex.${i}.r${r}" type="number" inputmode="numeric" value="${v}" placeholder="${r < info.rounds ? ex.max : '-'}" aria-label="Round ${r + 1} ${unitLbl}">`;
    }
    return card(`<div class="ex-head"><span class="ex-num">${i + 1}</span><div><div class="ex-name">${U.esc(ex.name)}</div><div class="muted">${U.esc(P.fmtTarget(ex))}</div></div></div>
      <div class="flip-slot">${flip(P.imgFor(chosen))}</div>
      ${ready ? `<div class="badge-up">&#9650; Ready to go up - ${U.esc(ready.suggestion)}</div>` : ''}
      <div class="cue">${U.esc(ex.cue)}</div>
      <label class="field"><span class="lbl">Exercise (swap if needed)</span><select name="ex.${i}.name" data-change="ex-swap">${options.map((o) => `<option ${o === chosen ? 'selected' : ''}>${U.esc(o)}</option>`).join('')}</select></label>
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
    <label class="check"><input type="checkbox" name="finisherDone" ${act?.finisherDone || tr?.fin ? 'checked' : ''}> Finisher done</label>`);
  html += card(`${scale('effort', act?.effort, { label: 'Session effort (1 - 10). 6 or under with all reps at the top = go up next time.' })}
    <div class="row2">
      ${field('Duration (min)', `<input name="durationMin" type="number" inputmode="numeric" value="${act?.durationSec ? Math.round(act.durationSec / 60) : tr ? Math.round(tr.sec / 60) || '' : ''}" placeholder="${info.minutes}">`)}
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
      html += card(`<h3>After the run: 5 min calf and hip mobility</h3><ul class="drills">${drills.map((m) => `<li class="drill">${flip(P.imgFor(m.name), 'flip-sm') || '<div class="flip-sm flip-none"></div>'}<div><b>${U.esc(m.name)}</b> <span class="muted">${m.sides === 2 ? `${m.hold} sec each side` : `${m.hold} sec`}</span><div class="cue">${U.esc(m.cue)}</div></div></li>`).join('')}</ul>`, 'card-quiet');
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
  openTimer({ title: info.run.title, segments: info.run.segments, planId: item?.id ?? null, onDoneHash: location.hash, photo: 'run' });
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

// ---- session preview ------------------------------------------------------------------------------
const row = (img, title, sub) => `<div class="li">${pic(img) || '<div class="li-th"></div>'}<div class="li-m"><b>${title}</b>${sub ? `<div class="sb">${sub}</div>` : ''}</div></div>`;
const secHead = (name, small) => `<div class="sec-h"><span>${U.esc(name)}</span>${small ? `<small>${U.esc(small)}</small>` : ''}</div>`;
const mmss = (sec) => (sec ? U.fmtDuration(sec) : '');

function previewSections(item, info) {
  if (info.type === 'strength') {
    const n = item.week;
    const w = P.week(n) || {};
    const best = P.guidedOptions(item.key, n, item.date).best;
    const warm = info.def.warmupSteps || [];
    const warmSec = warm.reduce((a, x) => a + x.s, 0);
    let h = secHead('Warm-up', `${Math.round(warmSec / 60)} min`) + warm.map((x) => row(P.imgFor(x.l), U.esc(x.l), mmss(x.s))).join('');
    const exs = info.def.exercises.map((id) => P.exerciseById(id)).filter(Boolean).map((e) => P.exerciseForWeek(e, n));
    h += secHead('Circuit', `${best.rounds} rounds - rest ${w.roundRest ?? state.settings.timing.roundRest} sec`);
    h += exs.map((ex) => {
      const kg = ex.load ? P.suggestedWeight(ex, ex.name, item.date) : null;
      return row(P.imgFor(ex.name), `<span class="x">${best.rounds}x</span> ${U.esc(ex.name)}`, `${U.esc(P.fmtTarget(ex))}${kg ? ` - ${kg} kg` : ''}`);
    }).join('');
    h += secHead('Finisher', '') + row(null, U.esc(info.finisher.label), '');
    h += secHead('Cool-down', `${Math.round(state.settings.timing.cooldown / 60)} min`) + row(P.imgFor('Kneeling hip flexor stretch'), 'Easy stretch', 'Hip flexors, hamstrings, chest');
    if (w.effort) h += `<div class="note">${U.esc(w.effort)}.</div>`;
    return h;
  }
  if (info.type === 'run') {
    const r = info.run;
    const parts = r.segments.map((sg) => {
      if (sg.x) return row(null, `<span class="x">${sg.x}x</span> ${sg.items.map((it) => `${U.esc(it.l)} ${mmss(it.s)}`).join(' / ')}`, sg.dropLast ? 'Last recovery skipped' : '');
      return row(null, U.esc(sg.l.replace(/ - tap Next when done/i, '')), sg.s ? mmss(sg.s) : 'Tap Next when you get there');
    }).join('');
    const s2 = state.settings;
    return secHead('The run', `${r.minutes} min`) + parts
      + `<div class="note">Easy = heart rate under ${s2.hrCapLow} - ${s2.hrCapHigh} (about ${s2.easyPace}). Walking to stay under it is fine.${r.kind === 'tempo' ? ` Tempo = comfortably hard, about ${s2.tempoPace}.` : ''}</div>`;
  }
  return '';
}

export function renderSession(planId) {
  const item = P.findItem(planId);
  if (!item.week) return { title: 'Session', html: '<p>Session not found.</p>' };
  const info = P.sessionInfo(item.key, item.week);
  const act = P.activityFor(planId);
  const status = P.statusOf(item);
  const type = info.type === 'floating' ? 'floating' : info.type;
  const ctx = { item, info, act, n: item.week, date: item.date, key: item.key, type, preview: true };
  const w = P.week(item.week) || {};
  const canMove = P.isCore(item.key) && status !== 'done' && !item.extra;
  const chips = [
    item.extra ? '<span class="tag tag-t">Trial</span>' : `<span class="tag tag-t">Week ${item.week}</span>`,
    status === 'done' ? '<span class="tag tag-good">&#10003; Complete</span>' : status === 'missed' ? '<span class="tag tag-bad">Missed</span>' : '',
    info.type === 'strength' ? `<span class="tag">Rest ${w.roundRest ?? state.settings.timing.roundRest} sec</span>` : '',
    item.movedFrom ? `<span class="tag">From ${U.dayShort(item.movedFrom)}</span>` : '',
  ].join('');
  const mins = info.type === 'strength' ? P.guidedOptions(item.key, item.week, item.date).best.min : info.minutes;
  const gear = info.type === 'strength' ? (item.key === 'strengthA' ? 'Dumbbells - Bench - BikeErg' : 'Dumbbells - Bench - Bands - RowErg') : info.subtitle;
  let heading = `<div class="sp-hero s-${info.type}">${heroBg(item)}<div class="hb-shade"></div>
    <div class="sp-in"><div class="tags">${chips}</div>
      <div class="kick">${U.dayName(item.date)} ${U.fmtDate(item.date)}${mins ? ` - ${mins} min` : ''}</div>
      <div class="disp sp-title">${U.esc(info.title)}</div><div class="sp-sub">${U.esc(gear)}</div></div></div>`;
  heading += `<div class="acts">
    ${canMove ? `<button data-act="move-open" data-id="${item.id}"><i>&#8644;</i>Move</button>` : ''}
    <button data-act="jump" data-to="log-form"><i>&#9998;</i>${act ? 'Edit log' : 'Log only'}</button>
    ${info.type === 'strength' ? '<a href="#/journal"><i>&#9776;</i>History</a>' : '<a href="#/progress"><i>&#8599;</i>Progress</a>'}
    ${canMove && status !== 'skipped' ? `<button data-act="skip" data-id="${item.id}"><i>&#8856;</i>Skip</button>` : ''}
  </div>`;
  heading += movePanel(item);
  if (item.extra?.note) heading += `<div class="note">${U.esc(item.extra.note)}</div>`;
  heading += previewSections(item, info);
  if (status !== 'done' && (info.type === 'strength' || info.type === 'run')) {
    let others = '';
    if (info.type === 'strength') {
      const { opts, best } = P.guidedOptions(item.key, item.week, item.date);
      others = opts.filter((o) => o.rounds !== best.rounds || best.compress).map((o) => `<button class="tag tag-btn" data-act="guided" data-key="${item.key}" data-n="${item.week}" data-date="${item.date}" data-r="${o.rounds}" data-c="" data-id="${item.id}" data-hash="#/session/${item.id}">${o.rounds} rounds - ${o.min} min</button>`).join('');
    }
    if (others) heading += `<div class="cta-others"><span class="muted small">Other lengths:</span>${others}</div>`;
    heading += `<div class="cta-dock">${primaryAction(item, status, 'cta cta-block')}</div>`;
  }
  if (type === 'floating') {
    const missed = P.missedThisWeek().filter((m) => P.freeDays(m).includes(item.date));
    if (missed.length) {
      heading += card(`<h3>Make-up option</h3>${missed.map((m) => `<button class="btn btn-primary btn-block" data-act="move" data-id="${m.id}" data-to="${item.date}">Do ${U.esc(P.sessionInfo(m.key, m.week).title)} here instead</button>`).join('')}<p class="muted">Day before a game - keep it light (drop a round if you need to).</p>`);
    }
  }
  heading += `<h2 class="sec-h log-h" id="log-form"><span>${act ? 'Your log' : info.type === 'cricket' || info.type === 'floating' ? 'Log it' : 'Log it yourself'}</span></h2>`;
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
