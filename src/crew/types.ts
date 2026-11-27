// Crew: friends see each other's posted session summaries and react with a tap. No comments, ever.
// The full climbing log never leaves the phone; a post holds only the fields the climber switched on.

export type ReactionKind = 'allez' | 'send' | 'crusher' | 'clean' | 'respect';
export const REACTIONS: ReactionKind[] = ['allez', 'send', 'crusher', 'clean', 'respect'];

export interface CrewProfile {
  id: string;
  username: string;
  firstName?: string | null;
  homeGym?: string | null;
}

export interface PyramidRow { g: string; sent: number; tried: number }

/** What a post can contain. Every field except the counts is optional: it is only there if the climber shared it. */
export interface PostData {
  /** Day the session happened (ISO), so the feed can say "Tue" even if it was posted later. */
  at: string;
  gym?: string;
  durationMin?: number;
  /** 'boulder', 'route' or 'mixed', for the label on the card. */
  style: 'boulder' | 'route' | 'mixed';
  climbs: number;
  sends: number;
  topBoulder?: string;
  topRoute?: string;
  flashes?: number;
  attempts?: number;
  pyramid?: PyramidRow[];
  project?: { name: string; grade: string; tries: number; sessions: number };
}

export interface CrewPost {
  id: string;
  author: CrewProfile;
  createdAt: string;
  data: PostData;
  counts: Record<ReactionKind, number>;
  mine: ReactionKind[];
}

export type Relation = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';

export interface Person extends CrewProfile { relation: Relation }

export type ClaimResult = { ok: true } | { ok: false; reason: 'taken' | 'reserved' | 'invalid' | 'error' };

/** Everything the Crew screens need from a backend. Two implementations: Supabase (live) and a local demo. */
export interface CrewApi {
  /** 'live' talks to the Crew server; 'demo' is sample data on this device for the web preview. */
  mode: 'live' | 'demo';
  /** Signed-in profile, 'needs-username' after sign-in but before a username is claimed, or null when signed out. */
  current(): Promise<CrewProfile | 'needs-username' | null>;
  signIn(): Promise<'ok' | 'cancelled'>;
  signOut(): Promise<void>;
  claimUsername(username: string, firstName?: string): Promise<ClaimResult>;
  updateProfile(p: { firstName?: string | null; homeGym?: string | null }): Promise<void>;
  people(): Promise<Person[]>;
  search(q: string): Promise<Person[]>;
  request(id: string): Promise<void>;
  accept(id: string): Promise<void>;
  /** Declines a request, cancels one you sent, or ends a friendship. */
  remove(id: string): Promise<void>;
  block(id: string): Promise<void>;
  unblock(id: string): Promise<void>;
  blocked(): Promise<CrewProfile[]>;
  report(id: string, reason: string, postId?: string): Promise<void>;
  feed(): Promise<CrewPost[]>;
  postsBy(id: string): Promise<CrewPost[]>;
  /** Posts (or re-posts) a summary for a local session; returns the post id. */
  publish(localRef: string, data: PostData): Promise<string>;
  unpublish(postId: string): Promise<void>;
  react(postId: string, kind: ReactionKind, on: boolean): Promise<void>;
  deleteAccount(): Promise<void>;
}
