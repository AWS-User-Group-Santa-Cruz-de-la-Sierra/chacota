/**
 * Types and constants shared by the server and the screens. Browser-safe: no AWS SDK, no LiveService.
 */
export const ANIMALS = ['jochi', 'tatu', 'nandu', 'capibara'] as const;
export type Animal = (typeof ANIMALS)[number];

export type Track = 'short' | 'normal' | 'long';
export const TRACKS: readonly Track[] = ['short', 'normal', 'long'];
export const TRACK_METERS: Record<Track, number> = { short: 120, normal: 160, long: 240 };
export const ROUND_MAX_MS: Record<Track, number> = { short: 30_000, normal: 40_000, long: 60_000 };

export const PICK_MS = 15_000;
export const COUNTDOWN_MS = 3_000;
export const CLOSING_MS = 10_000;
export const PODIUM_FINISHERS = 3;
export const MAX_PLAYERS = 100;
export const BAG_COLORS = 6;

export interface EmbolsauConfig {
  meter: boolean;
  track: Track;
  rounds: 1 | 2 | 3;
  maxPlayers: number;
  /** The race's name, shown under the activity in the lobby and in the history. */
  title?: string;
}

/** The session title when the form leaves the name empty. */
export const DEFAULT_TITLE = 'Carrera de embolsados';

export type Phase = 'picking' | 'countdown' | 'racing' | 'closing' | 'roundResults';

export interface EmbolsauState {
  config: EmbolsauConfig;
  phase: Phase | null;
  round: number;
  phaseEndsAt: number | null;
  raceStartedAt: number | null;
}

// FNV-1a, the same hash the platform shards with; kept here so screens don't import the server package.
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Bag color index, stable per player, so runners with the same animal can be told apart. */
export function bagOf(playerId: string): number {
  return fnv1a(playerId) % BAG_COLORS;
}

/** Depth in the crowd, in [0, 1): 0 at the back, near 1 at the front. */
export function laneOf(playerId: string): number {
  return (fnv1a(`lane:${playerId}`) % 1000) / 1000;
}

/** What a phone's race answer and snapshot carry about its own runner. */
export interface RunnerResult {
  animal: Animal;
  meters: number;
  speed: number;
  down: boolean;
  /** Server time until which the runner is down. */
  downUntil: number;
  finished: boolean;
  place: number | null;
  falls: number;
}

export interface RoundRank {
  place: number;
  points: number;
  total: number;
}

export interface RoundPlace {
  playerId: string;
  nickname: string;
  place: number;
  meters: number;
  /** Milliseconds from the start to the line, or null if it didn't finish. */
  timeMs: number | null;
  points: number;
}

/** One runner on the presenter's screen. */
export interface StandingRunner {
  id: string;
  nickname: string;
  animal: Animal;
  bag: number;
  meters: number;
  speed: number;
  down: boolean;
  place: number;
  finished: boolean;
}

export interface PhaseInfo {
  phase: Phase | null;
  round: number;
  rounds: number;
  phaseEndsAt: number | null;
  raceStartedAt: number | null;
}

export type EmbolsauEvent =
  | ({ type: 'embolsau.phase'; meter: boolean; track: Track } & PhaseInfo)
  | { type: 'embolsau.roundResults'; round: number; rounds: number; top: RoundPlace[]; ranks: Record<string, RoundRank> }
  | { type: 'embolsau.standings'; round: number; at: number; runners: StandingRunner[] }
  | { type: 'embolsau.picks'; counts: Record<Animal, number>; picked: number };

export interface PlayerSnapshot extends PhaseInfo {
  track: Track;
  meter: boolean;
  animal: Animal | null;
  inRound: boolean;
  runner: RunnerResult | null;
  lastRank?: RoundRank;
}

export interface HostSnapshot extends PhaseInfo {
  track: Track;
  meter: boolean;
  config: EmbolsauConfig;
  lastRound?: { round: number; top: RoundPlace[]; ranks: Record<string, RoundRank> };
}
