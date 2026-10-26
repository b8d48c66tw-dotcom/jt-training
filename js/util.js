// Date and formatting helpers. Dates are local 'YYYY-MM-DD' strings throughout.

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const dow = (s) => parse(s).getDay();
export const mondayOf = (s) => addDays(s, -((dow(s) + 6) % 7));

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dayName = (s) => DAYS[dow(s)];
export const dayShort = (s) => DAYS[dow(s)].slice(0, 3);
export const fmtDate = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtDateLong = (s) => { const d = parse(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`; };
export const fmtDateYear = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

// Seconds to m:ss or h:mm:ss
export function fmtDuration(sec) {
  if (sec == null || isNaN(sec)) return '-';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
// Accepts '42', '42:30', '1:02:30' (minutes if no colon)
export function parseDuration(str) {
  if (str == null) return null;
  str = String(str).trim();
  if (!str) return null;
  const parts = str.split(':').map((p) => Number(p));
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return Math.round(parts[0] * 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
export const paceSec = (km, sec) => (km > 0 && sec > 0 ? sec / km : null);
export const fmtPace = (secPerKm) => {
  if (!secPerKm) return '-';
  const t = Math.round(secPerKm);
  return `${Math.floor(t / 60)}:${pad(t % 60)}/km`;
};

export const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
export const round1 = (n) => Math.round(n * 10) / 10;
export const fmtKg = (n) => (n == null ? '-' : `${round1(n).toFixed(1)} kg`);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}
