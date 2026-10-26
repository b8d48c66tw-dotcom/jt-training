// Small dependency-free SVG charts with a tap/hover tooltip.
import { esc } from './util.js';

const registry = new Map();
let seq = 0;

const W = 480, H = 250, PAD = { l: 50, r: 12, t: 14, b: 32 };

function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

// opts: { series: [{ name, cls, points: [{x, y, tip}], line, dots, dash, width }], xMin, xMax, yMin, yMax,
//         invertY, yFmt, xLabels: [{x, label}], hoverSeries: [indexes], empty }
export function lineChart(opts) {
  const all = opts.series.flatMap((s) => s.points);
  if (!all.length) return `<div class="chart-empty">${esc(opts.empty || 'No data yet')}</div>`;
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const xMin = opts.xMin ?? Math.min(...xs), xMax = opts.xMax ?? Math.max(...xs);
  let yMin = opts.yMin ?? Math.min(...ys), yMax = opts.yMax ?? Math.max(...ys);
  const padY = (yMax - yMin) * 0.08 || 1;
  if (opts.yMin == null) yMin -= padY;
  if (opts.yMax == null) yMax += padY;
  const ticks = niceTicks(yMin, yMax, 4);
  yMin = Math.min(yMin, ticks[0]);
  yMax = Math.max(yMax, ticks[ticks.length - 1]);
  const sx = (x) => PAD.l + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD.l - PAD.r);
  const sy = (y) => {
    const f = (y - yMin) / (yMax - yMin || 1);
    return opts.invertY ? PAD.t + f * (H - PAD.t - PAD.b) : H - PAD.b - f * (H - PAD.t - PAD.b);
  };
  const yFmt = opts.yFmt || ((v) => v);
  let svg = '';
  for (const t of ticks) {
    svg += `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${sy(t)}" y2="${sy(t)}"/>`;
    svg += `<text class="axis" x="${PAD.l - 6}" y="${sy(t) + 4}" text-anchor="end">${esc(yFmt(t))}</text>`;
  }
  for (const xl of opts.xLabels || []) {
    svg += `<text class="axis" x="${sx(xl.x)}" y="${H - 8}" text-anchor="middle">${esc(xl.label)}</text>`;
  }
  opts.series.forEach((s) => {
    const pts = s.points.filter((p) => p.y != null).sort((a, b) => a.x - b.x);
    if (s.line !== false && pts.length > 1) {
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
      svg += `<path class="ln ${s.cls}" d="${d}" ${s.dash ? 'stroke-dasharray="6 5"' : ''} style="stroke-width:${s.width || 2}"/>`;
    }
    if (s.dots) for (const p of pts) svg += `<circle class="dot ${s.cls}" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${s.r || 4}"/>`;
  });
  const id = 'c' + ++seq;
  const hover = (opts.hoverSeries || opts.series.map((_, i) => i)).flatMap((i) =>
    opts.series[i].points.filter((p) => p.y != null && p.tip).map((p) => ({ x: sx(p.x), y: sy(p.y), tip: p.tip })));
  registry.set(id, hover);
  svg += `<line class="cross" x1="0" x2="0" y1="${PAD.t}" y2="${H - PAD.b}" style="display:none"/>`;
  svg += `<circle class="cross-dot" r="6" style="display:none"/>`;
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Chart')}">${svg}</svg><div class="tip" hidden></div></div>`;
}

// opts: { bars: [{ label, value, tip, cls }], yFmt, empty, highlight }
export function barChart(opts) {
  if (!opts.bars.length) return `<div class="chart-empty">${esc(opts.empty || 'No data yet')}</div>`;
  const max = Math.max(...opts.bars.map((b) => b.value), opts.minMax ?? 5);
  const ticks = niceTicks(0, max, 4);
  const yMax = ticks[ticks.length - 1];
  const sy = (v) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const n = opts.bars.length;
  const slot = (W - PAD.l - PAD.r) / n;
  const bw = Math.max(3, Math.min(36, slot - 4));
  const yFmt = opts.yFmt || ((v) => v);
  let svg = '';
  for (const t of ticks) {
    svg += `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${sy(t)}" y2="${sy(t)}"/>`;
    svg += `<text class="axis" x="${PAD.l - 6}" y="${sy(t) + 4}" text-anchor="end">${esc(yFmt(t))}</text>`;
  }
  const hover = [];
  const every = Math.ceil(n / 7);
  opts.bars.forEach((b, i) => {
    const x = PAD.l + i * slot + (slot - bw) / 2;
    const y = sy(b.value);
    const h = H - PAD.b - y;
    if (h > 0) {
      const r = Math.min(4, bw / 2, h);
      svg += `<path class="bar ${b.cls || ''}" d="M${x},${H - PAD.b} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${H - PAD.b} Z"/>`;
    }
    if (i % every === 0 || i === n - 1) svg += `<text class="axis" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(b.label)}</text>`;
    hover.push({ x: x + bw / 2, y: Math.min(y, H - PAD.b - 2), tip: b.tip || `${b.label}: ${yFmt(b.value)}` });
  });
  const id = 'c' + ++seq;
  registry.set(id, hover);
  svg += `<line class="cross" x1="0" x2="0" y1="${PAD.t}" y2="${H - PAD.b}" style="display:none"/>`;
  svg += `<circle class="cross-dot" r="6" style="display:none"/>`;
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Chart')}">${svg}</svg><div class="tip" hidden></div></div>`;
}

export function hydrateCharts(root) {
  root.querySelectorAll('.chart[data-chart]').forEach((el) => {
    const pts = registry.get(el.dataset.chart);
    if (!pts || !pts.length) return;
    const svg = el.querySelector('svg');
    const tip = el.querySelector('.tip');
    const cross = svg.querySelector('.cross');
    const dot = svg.querySelector('.cross-dot');
    const show = (ev) => {
      const r = svg.getBoundingClientRect();
      const vx = ((ev.clientX - r.left) / r.width) * W;
      let best = pts[0];
      for (const p of pts) if (Math.abs(p.x - vx) < Math.abs(best.x - vx)) best = p;
      cross.setAttribute('x1', best.x); cross.setAttribute('x2', best.x); cross.style.display = '';
      dot.setAttribute('cx', best.x); dot.setAttribute('cy', best.y); dot.style.display = '';
      tip.hidden = false;
      tip.textContent = best.tip;
      const px = (best.x / W) * r.width;
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(r.width - tw, px - tw / 2)) + 'px';
      tip.style.top = Math.max(0, (best.y / H) * r.height - 44) + 'px';
    };
    const hide = () => { tip.hidden = true; cross.style.display = 'none'; dot.style.display = 'none'; };
    el.addEventListener('pointermove', show);
    el.addEventListener('pointerdown', show);
    el.addEventListener('pointerleave', hide);
  });
}
