import type { ClimbType, Outcome } from '../types';

export const BOULDER_GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12+'];
export const ROUTE_GRADES = [
  '5.5', '5.6', '5.7', '5.8', '5.9',
  '5.10a', '5.10b', '5.10c', '5.10d',
  '5.11a', '5.11b', '5.11c', '5.11d',
  '5.12a', '5.12b', '5.12c', '5.12d',
  '5.13a', '5.13b', '5.13c', '5.13d',
  '5.14a', '5.14b', '5.14c', '5.14d',
  '5.15a+',
];

export const gradesFor = (t: ClimbType) => (t === 'boulder' ? BOULDER_GRADES : ROUTE_GRADES);

export function gradeIndex(t: ClimbType, grade: string): number | null {
  const i = gradesFor(t).indexOf(grade);
  return i < 0 ? null : i;
}

export function gradeLabel(t: ClimbType, idx: number | null | undefined): string {
  if (idx == null || Number.isNaN(idx)) return '—';
  const list = gradesFor(t);
  return list[Math.max(0, Math.min(list.length - 1, Math.round(idx)))];
}

/** Average grade label: V3.6 for boulders, ≈5.10c for routes. */
export function gradeAvgLabel(t: ClimbType, v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return t === 'boulder' ? 'V' + v.toFixed(1) : '≈' + gradeLabel('route', v);
}

export interface OutcomeDef {
  id: Outcome;
  label: string;
  desc: string;
}

export const OUTCOMES: Record<ClimbType, OutcomeDef[]> = {
  route: [
    { id: 'onsight', label: 'On-sight', desc: 'First try, no beta' },
    { id: 'flash', label: 'Flash', desc: 'First try, with beta' },
    { id: 'redpoint', label: 'Redpoint', desc: 'Sent after attempts' },
    { id: 'project', label: 'Project', desc: 'Not sent yet' },
    { id: 'repeat', label: 'Repeat', desc: 'Climbed it before' },
  ],
  boulder: [
    { id: 'flash', label: 'Flash', desc: 'First try' },
    { id: 'sent', label: 'Sent', desc: 'After attempts' },
    { id: 'project', label: 'Project', desc: 'Not sent yet' },
    { id: 'repeat', label: 'Repeat', desc: 'Sent before' },
  ],
};

export function outcomeLabel(o: Outcome): string {
  const all = [...OUTCOMES.route, ...OUTCOMES.boulder];
  return all.find((d) => d.id === o)?.label ?? o;
}

/** Any completed climb, repeats included. */
export const isSend = (o: Outcome) => o !== 'project';
/** A first-time send (repeats excluded). Rates and attempts-per-send use these. */
export const isNewSend = (o: Outcome) => o !== 'project' && o !== 'repeat';
export const isFirstTry = (o: Outcome) => o === 'flash' || o === 'onsight';

/** Map an outcome across types when the climber switches Routes ↔ Bouldering. */
export function mapOutcome(o: Outcome, to: ClimbType): Outcome {
  const ids = OUTCOMES[to].map((d) => d.id);
  if (ids.includes(o)) return o;
  if (o === 'redpoint') return 'sent';
  if (o === 'sent') return 'redpoint';
  if (o === 'onsight') return 'flash';
  return ids[0];
}

export const HOLD_COLORS: { name: string; hex: string }[] = [
  { name: 'Yellow', hex: '#F5D90A' },
  { name: 'Green', hex: '#3DBE6B' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Purple', hex: '#9B6CFF' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Orange', hex: '#FF8A3D' },
  { name: 'Pink', hex: '#F472B6' },
  { name: 'White', hex: '#F2F1EC' },
  { name: 'Black', hex: '#2A2B2E' },
  { name: 'Teal', hex: '#14B8A6' },
];
export const colorHex = (name?: string) => HOLD_COLORS.find((c) => c.name === name)?.hex ?? '#6B6E75';

export const ANGLES = ['slab', 'vertical', 'overhang', 'roof'] as const;
export const ANGLE_LABEL: Record<string, string> = { slab: 'Slab', vertical: 'Vertical', overhang: 'Overhang', roof: 'Roof' };
export const BOULDER_STYLES = ['Technical', 'Powerful', 'Dynamic', 'Slab', 'Compression', 'Coordination'];
export const ROUTE_HOLDS = ['Crimps', 'Slopers', 'Jugs', 'Pinches', 'Pockets', 'Endurance'];
