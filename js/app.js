// Bootstrap, router and event delegation.
import { loadState, state } from './store.js';
import { actions, setRenderer, card, toast } from './core.js';
import { esc } from './util.js';
import { handleRedirect, autoSync } from './strava.js';
import { hydrateCharts } from './charts.js';
import { renderToday } from './screens/today.js';
import { renderWeek } from './screens/week.js';
import { renderSession, renderNewLog, renderActivity } from './screens/session.js';
import { renderLog } from './screens/log.js';
import { renderProgress, renderCheckin } from './screens/progress.js';
import { renderFood } from './screens/food.js';
import { renderSettings, renderEditor } from './screens/settings.js';

const routes = {
  today: () => renderToday(),
  day: (d) => renderToday(d),
  week: (n) => renderWeek(n),
  session: (id) => renderSession(decodeURIComponent(id)),
  new: (k) => renderNewLog(k),
  activity: (id) => renderActivity(id),
  log: () => renderLog(),
  progress: () => renderProgress(),
  food: () => renderFood(),
  settings: () => renderSettings(),
  checkin: (n) => renderCheckin(n),
  edit: (k) => renderEditor(k),
};
const TAB_FOR = { today: 'today', day: 'today', session: 'today', week: 'week', log: 'log', new: 'log', activity: 'log', progress: 'progress', checkin: 'progress', food: 'food' };

function render() {
  const [name, arg] = (location.hash.replace(/^#\/?/, '') || 'today').split('/');
  const fn = routes[name] || routes.today;
  const { title, html } = fn(arg);
  document.getElementById('title').textContent = title;
  const view = document.getElementById('view');
  view.innerHTML = html;
  hydrateCharts(view);
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (TAB_FOR[name] || 'today')));
}

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) { e.preventDefault(); actions[el.dataset.act](el, e); }
});
document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.dataset.submit && actions[f.dataset.submit]) { e.preventDefault(); actions[f.dataset.submit](f, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && actions[el.dataset.change]) actions[el.dataset.change](el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && actions[el.dataset.input]) actions[el.dataset.input](el, e);
});

await loadState();
applyTheme();
setRenderer(render);
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// Returning from Strava's sign-in page?
const back = await handleRedirect();
if (back.handled && back.code) {
  // The redirect opened outside the installed app (common on iPhone), so this copy of the app has no keys.
  document.getElementById('title').textContent = 'Strava';
  document.getElementById('view').innerHTML = card(`<h2>Almost connected</h2>
    <p>Strava opened this page in Safari instead of the installed app. Copy this code, open JT Training from your home screen, go to Settings, Strava, "Ended up in Safari with a code?" and paste it. Do it within a few minutes - the code expires.</p>
    <input class="big-input" readonly value="${esc(back.code)}" onclick="this.select()">
    <button class="btn btn-primary btn-lg btn-block" onclick="navigator.clipboard.writeText('${esc(back.code)}').then(()=>this.textContent='Copied')">Copy code</button>`);
} else {
  render();
  if (back.handled) toast(back.message);
  else autoSync().then((r) => { if (r && r.added) { toast(`Strava: ${r.added} new`); render(); } });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
