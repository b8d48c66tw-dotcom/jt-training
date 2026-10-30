// Nutrition: today's ticks, targets, a typical day, portions, swipeable meal options and guides.
import { state } from '../store.js';
import * as U from '../util.js';
import { nutritionCard } from './today.js';

const ICON = {
  kcal: '<path d="M24 6c2 7 10 10 10 20a10 10 0 0 1-20 0c0-5 3-8 5-11 1 4 3 5 5 6 0-6-2-10 0-15z"/>',
  protein: '<path d="M14 30l14-14M18 34a6 6 0 1 1-6-6M30 14a6 6 0 1 1 6 6"/>',
  water: '<path d="M24 6c6 9 12 15 12 22a12 12 0 0 1-24 0c0-7 6-13 12-22z"/>',
  fibre: '<path d="M10 38C10 20 22 10 38 10c0 16-10 28-28 28zM10 38l16-16"/>',
  steps: '<path d="M16 8c4 0 5 6 4 12s-7 6-8 0 0-12 4-12zM14 26h7l-1 6a3 3 0 0 1-6 0zM32 16c4 0 5 6 4 12s-7 6-8 0 0-12 4-12zM30 34h7l-1 6a3 3 0 0 1-6 0z"/>',
  dinner: '<circle cx="24" cy="24" r="12"/><path d="M6 10v10a3 3 0 0 0 6 0V10M9 20v18M40 10c-3 2-4 6-4 10h4v18"/>',
  early: '<path d="M30 8a16 16 0 1 0 10 26A14 14 0 0 1 30 8z"/>',
  cricket: '<path d="M30 6l6 6-17 17-6-6zM13 23l-6 6"/><circle cx="35" cy="34" r="5"/>',
  training: '<path d="M8 20v8M14 16v16M34 16v16M40 20v8M14 24h20"/>',
  xmas: '<path d="M24 6l10 14h-5l8 11h-6l6 9H11l6-9h-6l8-11h-5z"/>',
  tips: '<path d="M18 34h12M20 40h8M24 6a11 11 0 0 0-7 20c2 2 2 4 2 6h10c0-2 0-4 2-6A11 11 0 0 0 24 6z"/>',
  sun: '<circle cx="24" cy="24" r="8"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4"/>',
};
const icon = (k, cls = 'fi') => `<span class="${cls}"><svg viewBox="0 0 48 48" aria-hidden="true">${ICON[k] || ''}</svg></span>`;

function targets() {
  const tg = state.settings.targets;
  const t = (k, v, l) => `<div class="tgt">${icon(k)}<b>${v}</b><small>${l}</small></div>`;
  return `<div class="tgts">
    ${t('kcal', tg.kcal.toLocaleString('en-AU'), 'kcal')}
    ${t('protein', `${tg.proteinLow}-${tg.proteinHigh}`, 'g protein')}
    ${t('water', `${tg.waterL} L`, 'water')}
    ${t('fibre', `${tg.fibreG}g+`, 'fibre')}
    ${t('steps', `${Math.round(tg.stepsLow / 1000)}-${Math.round(tg.stepsHigh / 1000)}k`, 'steps')}
  </div>`;
}

function typicalDay() {
  const N = state.nutrition;
  let kcal = 0, protein = 0;
  const total = N.dayShape.reduce((a, m) => a + m.kcal, 0);
  const rows = N.dayShape.map((m) => {
    kcal += m.kcal; protein += m.protein;
    return `<div class="tl-row"><span class="tl-dot"></span><div class="tl-m">
      <div class="tl-top"><b>${U.esc(m.meal)}</b><span class="tl-mac">${m.kcal} kcal - ${m.protein} g</span></div>
      <div class="muted">${U.esc(m.detail)}</div>
      <div class="tl-bar"><i style="width:${Math.round((kcal / total) * 100)}%"></i></div>
    </div></div>`;
  }).join('');
  return `<div class="sec-h"><span>A typical day</span><small>${kcal.toLocaleString('en-AU')} kcal - ${protein} g protein</small></div>
    <div class="card timeline">${rows}</div>`;
}

function portions() {
  const P = [['Palm', 'of protein', 'Two at lunch and dinner'], ['Fist', 'of carbs', 'Add half on run days'], ['2 fists', 'of veg', 'At lunch and dinner'], ['Thumb', 'of fats', 'Oils, nuts, avocado']];
  return `<div class="sec-h"><span>Portions by hand</span><small>No scales needed</small></div>
    <div class="hands">${P.map(([a, b, c]) => `<div class="hand"><b class="disp">${a}</b><span>${b}</span><small>${c}</small></div>`).join('')}</div>`;
}

function carousel(title, items, tone) {
  return `<div class="sec-h"><span>${U.esc(title)}</span><small>${items.length} options - swipe</small></div>
    <div class="car">${items.map((o) => `<div class="meal m-${tone}">
      <div class="meal-top"><span class="meal-k"><b>${o.kcal}</b> kcal</span><span class="meal-p"><b>${o.protein}</b> g protein</span></div>
      <div class="meal-t">${U.esc(o.name)}</div>
      <div class="meal-d">${U.esc(o.detail)}</div>
    </div>`).join('')}</div>`;
}

const bullets = (items) => `<ul class="plain">${items.map((t) => `<li>${U.esc(t)}</li>`).join('')}</ul>`;
function guide(ic, title, sub, body, tone) {
  return `<details class="guide g2-${tone}"><summary>${icon(ic, 'gi')}<span class="g-txt"><b>${U.esc(title)}</b><small>${U.esc(sub)}</small></span><span class="g-chev">+</span></summary><div class="g-body">${body}</div></details>`;
}

export function renderFood() {
  const N = state.nutrition;
  let html = `<div class="page-head"><div class="disp disp-lg">Food</div><div class="muted">Protein first. A flexible framework, not a fixed meal plan.</div></div>`;
  html += targets();
  html += nutritionCard(U.today());
  html += typicalDay();
  html += portions();
  html += carousel('Breakfast', N.breakfast, 'am');
  html += carousel('Lunch', N.lunch, 'mid');
  html += carousel('Snacks', N.snacks, 'snack');
  html += `<div class="sec-h"><span>Guides</span><small>Tap to open</small></div>`;
  html += guide('dinner', 'Dinner guide', 'For the dinner planner', `${bullets(N.dinner.guidance)}<h3>Dinner ideas</h3>${bullets(N.dinner.ideas)}`, 'teal');
  html += guide('early', '4am sessions', 'What to have before and after', bullets(N.earlySessions), 'blue');
  html += guide('cricket', 'Saturday game day', 'Fuel for a 6 - 7 hour day', bullets(N.cricketGame), 'orange');
  html += guide('training', 'Thursday training', 'After cricket training', bullets(N.cricketTraining), 'orange');
  html += guide('xmas', 'Survive the silly season', 'Christmas without the blowout', bullets(N.christmas), 'violet');
  html += guide('tips', 'Tips from your old plan', 'Small swaps, big difference', bullets(N.tips), 'blue');
  html += `<a class="cta cta-ghost cta-block" href="#/edit/nutrition">Edit meal options</a>`;
  return { title: 'Food', html };
}
