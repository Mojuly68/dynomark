import type { Climb, ClimbType } from '../types';
import { gradeLabel, gradesFor, isSend } from './grades';

/**
 * Working grade: the median of your five hardest non-warm-up sends in the last 30 days
 * (or ever, if the last 30 days are empty). Null with no sends of that type.
 */
export function workingGrade(climbs: Climb[], type: ClimbType, now = new Date()): number | null {
  const sends = climbs.filter((c) => c.type === type && !c.warmup && isSend(c.outcome) && c.gradeIdx != null);
  const since = now.getTime() - 30 * 86400000;
  const recent = sends.filter((c) => new Date(c.at).getTime() >= since);
  const pool = (recent.length >= 3 ? recent : sends).map((c) => c.gradeIdx as number).sort((a, b) => b - a).slice(0, 5);
  if (!pool.length) return null;
  return pool[Math.floor(pool.length / 2)];
}

export interface LadderStep { idx: number; grade: string; count: number }

/**
 * A warm-up ladder that builds to `target`. Boulders: four steps below the target, two climbs each,
 * one at the step just below. Routes are longer, so three single routes spread over about two number grades.
 */
export function warmupLadder(type: ClimbType, target: number): LadderStep[] {
  const plan: [number, number][] = type === 'boulder'
    ? [[-4, 2], [-3, 2], [-2, 2], [-1, 1]]
    : [[-8, 1], [-5, 1], [-3, 1]];
  const seen = new Set<number>();
  const steps: LadderStep[] = [];
  for (const [off, count] of plan) {
    const idx = Math.max(0, target + off);
    if (idx >= target && target > 0) continue;
    if (seen.has(idx)) { const s = steps.find((x) => x.idx === idx); if (s) s.count += count; continue; }
    seen.add(idx);
    steps.push({ idx, grade: gradeLabel(type, idx), count });
  }
  if (!steps.length) steps.push({ idx: 0, grade: gradeLabel(type, 0), count: type === 'boulder' ? 3 : 1 });
  return steps;
}

export const maxGradeIdx = (type: ClimbType) => gradesFor(type).length - 1;
