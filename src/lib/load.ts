import type { Exercise } from '../types';
import { KG_PER_LB } from './profile';

/** Hangs are logged as "added weight × time"; negative added weight means assisted (pulley or band). */
export const isHang = (ex: Exercise | undefined) => ex?.kind === 'weight_time';

export const toKg = (v: number, unit: 'kg' | 'lb') => (unit === 'kg' ? v : v * KG_PER_LB);
export const fromKg = (kg: number, unit: 'kg' | 'lb') => (unit === 'kg' ? kg : kg / KG_PER_LB);

/** Total load on the fingers as a percentage of body weight. */
export const pctBodyWeight = (bodyKg: number, addedKg: number) => ((bodyKg + addedKg) / bodyKg) * 100;

/** Added weight (negative = assistance) needed to hang a target percentage of body weight. */
export const addedForPct = (bodyKg: number, pct: number) => bodyKg * (pct / 100 - 1);

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const fmtSigned = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(round1(n));
