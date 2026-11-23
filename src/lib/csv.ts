import { isNative, shareFileNative } from './native';
import type { AppData, Gym } from '../types';

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function climbsCsv(d: AppData, gyms: Gym[]) {
  const name = new Map(gyms.map((g) => [g.id, g.name]));
  const head = ['date', 'time', 'gym', 'session_id', 'type', 'grade', 'outcome', 'attempts', 'rope_style', 'angle', 'color', 'styles', 'name', 'feel', 'notes', 'project_id', 'sample_data'];
  const rows = d.climbs
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((c) => {
      const at = new Date(c.at);
      return [
        at.toISOString().slice(0, 10), at.toTimeString().slice(0, 5), name.get(c.gymId) ?? c.gymId, c.sessionId, c.type, c.grade, c.outcome, c.attempts,
        c.ropeStyle ?? '', c.angle ?? '', c.color ?? '', c.styles.join('; '), c.name ?? '', c.feel ?? '', c.notes ?? '', c.projectId ?? '', c.isDemo ? 'yes' : 'no',
      ].map(esc).join(',');
    });
  return [head.join(','), ...rows].join('\n');
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  if (isNative()) { void shareFileNative(filename, text); return; }
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
