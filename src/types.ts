// Data model for DYNOMARK. Every record is plain JSON so the local store can later be
// swapped for an API + database without changing the screens (see store/storage.ts).

export type ID = string;
export type ISODate = string;

export type Discipline = 'bouldering' | 'top-rope' | 'lead' | 'auto-belay';
export type ClimbType = 'route' | 'boulder';
export type RouteOutcome = 'onsight' | 'flash' | 'redpoint' | 'project' | 'repeat';
export type BoulderOutcome = 'flash' | 'sent' | 'project' | 'repeat';
export type Outcome = RouteOutcome | BoulderOutcome;
export type WallAngle = 'slab' | 'vertical' | 'overhang' | 'roof';
export type RopeStyle = 'lead' | 'top-rope';
export type Feel = 'soft' | 'on' | 'hard';
export type Brand = 'Touchstone' | 'Benchmark' | 'Bridges' | 'Custom';

export interface User {
  id: ID;
  name: string;
  /** True while the account holds generated sample data. */
  isDemo: boolean;
  createdAt: ISODate;
  /** Profile photo as a small JPEG data URL (256×256), kept on this device only. */
  photo?: string;
  /** Body measurements are stored in metric and shown in the climber's chosen units. */
  weightKg?: number;
  heightCm?: number;
  gender?: Gender;
  /** Free text when gender is 'self'. */
  genderText?: string;
  experience?: Experience;
}

export type Gender = 'woman' | 'man' | 'nonbinary' | 'self' | 'undisclosed';
export type Experience = 'new' | 'beginner' | 'intermediate' | 'advanced' | 'elite';

export interface Gym {
  id: ID;
  name: string;
  brand: Brand;
  city: string;
  state: string;
  address?: string;
  website: string;
  /** Disciplines the gym's own site states. null = not stated there. */
  disciplines: Discipline[] | null;
  disciplinesSource: 'gym-site' | null;
  amenities: string[];
  description?: string;
  custom?: boolean;
}

/** The climber's own corrections and notes for a gym. */
export interface GymOverride {
  disciplines?: Discipline[];
  /** Grade steps to add when comparing this gym with others (e.g. -1 = soft). */
  gradeAdjust?: number;
  gradeNote?: string;
}

export interface Session {
  id: ID;
  gymId: ID;
  startedAt: ISODate;
  endedAt: ISODate | null;
  notes?: string;
  isDemo?: boolean;
}

export interface Climb {
  id: ID;
  sessionId: ID;
  gymId: ID;
  type: ClimbType;
  /** Label as logged, e.g. "V5", "5.11a" or a custom gym grade. */
  grade: string;
  /** Position on the standard scale used for stats; null if it can't be placed. */
  gradeIdx: number | null;
  outcome: Outcome;
  attempts: number;
  ropeStyle?: RopeStyle;
  color?: string;
  angle?: WallAngle;
  styles: string[];
  name?: string;
  notes?: string;
  feel?: Feel;
  /** File names only in this prototype; uploads need the backend. */
  media?: string[];
  projectId?: ID;
  /** Warm-up climb: counts toward volume, left out of grade averages and send rates. */
  warmup?: boolean;
  at: ISODate;
  isDemo?: boolean;
}

export interface ProjectAttempt {
  id: ID;
  date: ISODate;
  tries: number;
  /** How far up the climb you got, 0-100. 100 = sent. */
  highPoint: number;
  note?: string;
}

export interface Project {
  id: ID;
  gymId: ID;
  type: ClimbType;
  name: string;
  grade: string;
  gradeIdx: number | null;
  startedAt: ISODate;
  status: 'active' | 'sent' | 'abandoned';
  sentAt?: ISODate;
  notes?: string;
  attempts: ProjectAttempt[];
  videos: string[];
  isDemo?: boolean;
}

export type ExerciseKind = 'weight_reps' | 'weight_time' | 'reps' | 'time';
export type ExerciseCategory = 'fingers' | 'pull' | 'core' | 'push' | 'mobility' | 'endurance' | 'power' | 'grip';

export interface Exercise {
  id: ID;
  name: string;
  category: ExerciseCategory;
  kind: ExerciseKind;
  defaultRest: number;
  custom?: boolean;
}

export interface TrainingSet {
  weight?: number;
  reps?: number;
  seconds?: number;
  done: boolean;
}

export interface TrainingEntry {
  id: ID;
  exerciseId: ID;
  sets: TrainingSet[];
  notes?: string;
}

export interface TrainingSession {
  id: ID;
  name: string;
  startedAt: ISODate;
  endedAt: ISODate | null;
  routineId?: ID;
  entries: TrainingEntry[];
  /** Body weight when the workout was finished, for % body weight on hangs. */
  bodyWeightKg?: number;
  isDemo?: boolean;
}

export interface Routine {
  id: ID;
  name: string;
  exerciseIds: ID[];
}

/** Derived from climbs on demand; the type is here so a backend can store them. */
export interface PersonalRecord {
  id: string;
  label: string;
  value: string;
  date: ISODate;
  gymId?: ID;
}

export interface Achievement {
  id: string;
  label: string;
  detail: string;
  date: ISODate;
  type: ClimbType | 'session' | 'streak';
}

export interface Settings {
  theme: 'dark' | 'light';
  units: 'lb' | 'kg';
  currentGymId: ID | null;
  favorites: ID[];
  /** DYNOMARK Pro. Absent = free. `source: 'preview'` is the testing switch, not a purchase. */
  pro?: ProState;
}

export type ProPlan = 'year' | 'month' | 'life';
export interface ProState {
  plan: ProPlan;
  since: ISODate;
  source: 'preview' | 'store';
}

export interface AppData {
  version: 1;
  user: User;
  customGyms: Gym[];
  gymOverrides: Record<ID, GymOverride>;
  sessions: Session[];
  climbs: Climb[];
  projects: Project[];
  exercises: Exercise[];
  routines: Routine[];
  training: TrainingSession[];
  settings: Settings;
  activeSessionId: ID | null;
  activeTrainingId: ID | null;
}
