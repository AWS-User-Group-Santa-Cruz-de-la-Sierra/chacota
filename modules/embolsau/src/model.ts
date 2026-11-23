/**
 * Types and constants shared by the server and the screens. Browser-safe: no AWS SDK, no LiveService.
 */
export const ANIMALS = ['jochi', 'tatu', 'nandu', 'capibara'] as const;
export type Animal = (typeof ANIMALS)[number];

export type Track = 'short' | 'normal' | 'long';
export const TRACKS: readonly Track[] = ['short', 'normal', 'long'];
export const TRACK_METERS: Record<Track, number> = { short: 160, normal: 240, long: 360 };
export const ROUND_MAX_MS: Record<Track, number> = { short: 40_000, normal: 60_000, long: 90_000 };

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
}

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
