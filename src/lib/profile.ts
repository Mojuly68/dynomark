import type { Experience, Gender } from '../types';
import { ROUTE_GRADES } from './grades';

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'self', label: 'Prefer to self-describe' },
  { value: 'undisclosed', label: 'Prefer not to say' },
];

export const EXPERIENCE: { value: Experience; label: string; hint: string }[] = [
  { value: 'new', label: 'New', hint: 'Under 6 months of climbing' },
  { value: 'beginner', label: 'Beginner', hint: 'V0–V2 · 5.6–5.9' },
  { value: 'intermediate', label: 'Intermediate', hint: 'V3–V5 · 5.10–5.11' },
  { value: 'advanced', label: 'Advanced', hint: 'V6–V8 · 5.12' },
  { value: 'elite', label: 'Elite', hint: 'V9+ · 5.13+' },
];

/** The level your logged hardest sends point to, or null with nothing logged. Only a suggestion. */
export function suggestExperience(topBoulder: number | null, topRoute: number | null): Experience | null {
  const order: Experience[] = ['beginner', 'intermediate', 'advanced', 'elite'];
  const b = topBoulder == null ? -1 : topBoulder <= 2 ? 0 : topBoulder <= 5 ? 1 : topBoulder <= 8 ? 2 : 3;
  const ri = (g: string) => ROUTE_GRADES.indexOf(g);
  const r = topRoute == null ? -1 : topRoute < ri('5.10a') ? 0 : topRoute < ri('5.12a') ? 1 : topRoute < ri('5.13a') ? 2 : 3;
  const best = Math.max(b, r);
  return best < 0 ? null : order[best];
}

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
const round1 = (n: number) => Math.round(n * 10) / 10;

export const kgToDisplay = (kg: number, unit: 'kg' | 'lb') => round1(unit === 'kg' ? kg : kg / KG_PER_LB);
export const displayToKg = (v: number, unit: 'kg' | 'lb') => (unit === 'kg' ? v : v * KG_PER_LB);
export function cmToFtIn(cm: number) {
  const total = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(total / 12), inch: total % 12 };
}
export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * CM_PER_IN;

/** Plausible ranges, so a typo doesn't get saved. */
export const WEIGHT_KG = { min: 20, max: 250 };
export const HEIGHT_CM = { min: 100, max: 250 };
