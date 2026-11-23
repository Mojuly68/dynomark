import type { Exercise, Routine } from '../types';

export const EXERCISES: Exercise[] = [
  { id: 'ex-maxhang', name: 'Max hang · 20 mm edge', category: 'fingers', kind: 'weight_time', defaultRest: 180 },
  { id: 'ex-repeaters', name: 'Repeaters 7:3', category: 'fingers', kind: 'weight_time', defaultRest: 180 },
  { id: 'ex-fingerboard', name: 'Fingerboard session', category: 'fingers', kind: 'time', defaultRest: 120 },
  { id: 'ex-deadhang', name: 'Dead hang', category: 'grip', kind: 'time', defaultRest: 120 },
  { id: 'ex-grip', name: 'Pinch block', category: 'grip', kind: 'weight_reps', defaultRest: 90 },
  { id: 'ex-pullup', name: 'Pull-ups', category: 'pull', kind: 'reps', defaultRest: 120 },
  { id: 'ex-wpullup', name: 'Weighted pull-ups', category: 'pull', kind: 'weight_reps', defaultRest: 150 },
  { id: 'ex-row', name: 'Inverted rows', category: 'pull', kind: 'reps', defaultRest: 90 },
  { id: 'ex-fl', name: 'Front lever tucks', category: 'core', kind: 'time', defaultRest: 90 },
  { id: 'ex-legs', name: 'Hanging leg raises', category: 'core', kind: 'reps', defaultRest: 90 },
  { id: 'ex-pushup', name: 'Push-ups', category: 'push', kind: 'reps', defaultRest: 90 },
  { id: 'ex-press', name: 'Overhead press', category: 'push', kind: 'weight_reps', defaultRest: 120 },
  { id: 'ex-mobility', name: 'Hip mobility flow', category: 'mobility', kind: 'time', defaultRest: 30 },
  { id: 'ex-arc', name: 'ARC endurance', category: 'endurance', kind: 'time', defaultRest: 300 },
  { id: 'ex-4x4', name: '4×4 boulders', category: 'endurance', kind: 'reps', defaultRest: 240 },
  { id: 'ex-campus', name: 'Campus ladders 1-3-5', category: 'power', kind: 'reps', defaultRest: 180 },
];

export const ROUTINES: Routine[] = [
  { id: 'rt-fingers', name: 'Fingers + pull', exerciseIds: ['ex-maxhang', 'ex-wpullup', 'ex-fl'] },
  { id: 'rt-power', name: 'Power', exerciseIds: ['ex-campus', 'ex-grip', 'ex-legs'] },
  { id: 'rt-endurance', name: 'Endurance + mobility', exerciseIds: ['ex-arc', 'ex-repeaters', 'ex-mobility'] },
  { id: 'rt-antagonist', name: 'Antagonist', exerciseIds: ['ex-pushup', 'ex-press', 'ex-row'] },
];

export const CATEGORY_LABEL: Record<string, string> = {
  fingers: 'Fingers', pull: 'Pull', core: 'Core', push: 'Push', mobility: 'Mobility', endurance: 'Endurance', power: 'Power', grip: 'Grip',
};
