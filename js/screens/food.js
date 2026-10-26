// Nutrition framework: targets, swap lists and guidance.
import { state } from '../store.js';
import * as U from '../util.js';
import { card } from '../core.js';
import { nutritionCard } from './today.js';

const optionList = (items) => items.map((o) => `<div class="opt">
  <div class="opt-top"><b>${U.esc(o.name)}</b><span class="opt-macros">${o.kcal} kcal - ${o.protein} g protein</span></div>
  <div class="muted">${U.esc(o.detail)}</div></div>`).join('');
const bullets = (items) => `<ul class="plain">${items.map((t) => `<li>${U.esc(t)}</li>`).join('')}</ul>`;
const section = (title, body, open = false) => `<details class="sect" ${open ? 'open' : ''}><summary>${U.esc(title)}</summary><div class="sect-body">${body}</div></details>`;

export function renderFood() {
  const N = state.nutrition;
  const tg = state.settings.targets;
  const total = N.dayShape.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein }), { kcal: 0, protein: 0 });
  let html = `<div class="stats">
    <div class="stat"><div class="stat-v">${tg.kcal.toLocaleString('en-AU')}</div><div class="stat-l">kcal</div></div>
    <div class="stat"><div class="stat-v">${tg.proteinLow}-${tg.proteinHigh}</div><div class="stat-l">g protein</div></div>
    <div class="stat"><div class="stat-v">${tg.waterL} L</div><div class="stat-l">water</div></div>
    <div class="stat"><div class="stat-v">${tg.fibreG}g+</div><div class="stat-l">fibre</div></div>
  </div>
  <p class="muted center">Steps ${tg.stepsLow.toLocaleString('en-AU')} - ${tg.stepsHigh.toLocaleString('en-AU')} a day. ${U.esc(N.summary.split('.')[0])}.</p>`;
  html += nutritionCard(U.today());
  html += card(section('A typical day', `<table class="tbl"><tbody>${N.dayShape.map((m) => `<tr><td><b>${U.esc(m.meal)}</b><div class="muted">${U.esc(m.detail)}</div></td><td class="num">${m.kcal}</td><td class="num">${m.protein} g</td></tr>`).join('')}
    <tr class="tot"><td><b>Total</b></td><td class="num"><b>${total.kcal}</b></td><td class="num"><b>${total.protein} g</b></td></tr></tbody></table>
    <h3>Portions by hand</h3>${bullets(N.portions)}`, true));
  html += card(section(`Breakfast swaps (${N.breakfast.length})`, optionList(N.breakfast)));
  html += card(section(`Lunch swaps (${N.lunch.length})`, optionList(N.lunch)));
  html += card(section(`Snack swaps (${N.snacks.length})`, optionList(N.snacks)));
  html += card(section('Dinner guidance (for the dinner planner)', `${bullets(N.dinner.guidance)}<h3>Dinner ideas</h3>${bullets(N.dinner.ideas)}`));
  html += card(section('4am sessions', bullets(N.earlySessions)));
  html += card(section('Saturday game day', bullets(N.cricketGame)));
  html += card(section('Thursday training', bullets(N.cricketTraining)));
  html += card(section('Survive the silly season', bullets(N.christmas)));
  html += card(section('Tips from your old plan', bullets(N.tips)));
  html += `<a class="btn btn-block" href="#/edit/nutrition">Edit meal options</a>`;
  return { title: 'Food', html };
}
