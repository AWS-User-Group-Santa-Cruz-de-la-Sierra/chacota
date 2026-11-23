export type SessionStatus = 'lobby' | 'running' | 'ended';

/** A live session of any activity: one PIN, its players, and the activity's own state. */
export interface Session<TState = unknown> {
  id: string;
  pin: string;
  orgId: string;
  /** Activity id, e.g. "tiluchi". */
  module: string;
  title: string;
  hostUserId: string;
  orgName: string;
  primaryColor?: string;
  /** The org's logo when the session started (S3 key). */
  logoKey?: string;
  status: SessionStatus;
  /** Incremented on every transition; guards against racing presenters. */
  version: number;
  playerCount: number;
  /** Set by the activity; joining past it fails with session_full. */
  maxPlayers?: number;
  createdAt: string;
  endedAt?: string;
  /** Reserved for rooms that chain activities under one PIN. Always undefined for now. */
  roomId?: string;
  state: TState;
}

export interface Player {
  id: string;
  sessionId: string;
  nickname: string;
  score: number;
  joinedAt: number;
  /** Activity-owned per-player data (e.g. Tiluchi's answer streak). */
  data?: Record<string, unknown>;
}

export interface Standing {
  nickname: string;
  score: number;
}

export interface RankEntry {
  rank: number;
  score: number;
}

export type PlatformEvent =
  | { type: 'player_joined'; nickname: string; playerCount: number }
  | { type: 'started'; serverNow: number }
  | {
      type: 'ended';
      /** Top 5: the three podium places, then two honorable mentions. */
      podium: Standing[];
      ranks: Record<string, RankEntry>;
    };

/** Activity events are namespaced: "<activity>.<event>". */
export type ModuleEvent = { type: `${string}.${string}`; [key: string]: unknown };

export type LiveEvent = PlatformEvent | ModuleEvent;

export interface ResultColumn {
  key: string;
  label: { es: string; en: string };
  format: 'int' | 'seconds' | 'text';
}

/** One row of the permanent results: what organizers need to hand out prizes. */
export interface ResultEntry {
  rank: number;
  nickname: string;
  /** Short code shown on the player's phone at the end, to check who is who. */
  code: string;
  score: number;
  extra: Record<string, number | string | null>;
}

/** What an activity adds to the results when its session ends. */
export interface ModuleResults {
  columns: ResultColumn[];
  /** Extra columns per player id. */
  extra: Record<string, ResultEntry['extra']>;
  details: unknown;
}

export interface SessionResultsSummary {
  sessionId: string;
  orgId: string;
  module: string;
  title: string;
  hostUserId: string;
  createdAt: string;
  endedAt: string;
  playerCount: number;
  podium: Standing[];
}

export interface SessionResults extends SessionResultsSummary {
  columns: ResultColumn[];
  standings: ResultEntry[];
  details: unknown;
}

export const channels = {
  /** Everyone in the session (players and presenter). */
  public: (sessionId: string) => `/game/${sessionId}`,
  /** Presenter only: live join notifications. */
  host: (sessionId: string) => `/game/${sessionId}/host`,
};

export const NICKNAME_MAX = 20;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Stable 4-character verification code for a player (no 0/O or 1/I to confuse). */
export function playerCode(playerId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < playerId.length; i++) {
    hash ^= playerId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[(hash >>> 0) % CODE_ALPHABET.length];
    hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  }
  return code;
}
