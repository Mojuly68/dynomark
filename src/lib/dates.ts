const DAY = 86400000;

/** Calendar-day arithmetic in local time, so daylight-saving changes don't shift the day. */
export const addDays = (d: Date, n: number) => {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
};
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Monday-based week start. */
export function startOfWeek(d: Date) {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7;
  return addDays(s, -dow);
}
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};
export const weekKey = (d: Date | string) => dayKey(startOfWeek(typeof d === 'string' ? new Date(d) : d));
export const monthKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
};
export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return d.getDate() + ' ' + MON[d.getMonth()];
};
export const fmtDayYear = (iso: string) => {
  const d = new Date(iso);
  return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
};
export const fmtWeekday = (iso: string) => DOW[new Date(iso).getDay()];
export const fmtMonth = (iso: string) => {
  const d = new Date(iso);
  return MON[d.getMonth()] + ' ' + d.getFullYear();
};
export const monthShort = (i: number) => MON[i];
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export function fmtDuration(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? h + 'h ' + (m % 60) + 'm' : m + 'm';
}
export function fmtClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(r).padStart(2, '0');
}
/** Value for <input type="datetime-local">. */
export function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}
export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}
