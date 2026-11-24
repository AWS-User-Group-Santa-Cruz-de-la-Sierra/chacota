export const SCENES = ['retrete', 'globazo', 'lagarto', 'micro72'] as const;
export type Scene = (typeof SCENES)[number];
export const SCENE_MS: Record<Scene, number> = { retrete: 7_000, globazo: 7_000, lagarto: 7_500, micro72: 9_000 };
export const WINNER_MS = 6_000;
export const LEAD_MS = 1_500;
export const MAX_OVERBOARD = 5;
export const DEFAULT_OVERBOARD = 2;
export const MIN_NAMES = 2;
export const MAX_NAMES = 500;
export const NAME_MAX = 40;
export const DEFAULT_TITLE = 'Rifa solidaria';

export type Mode = 'list' | 'qr';
export type OnOverboard = 'discard' | 'return';
export type EntryStatus = 'bag' | 'out' | 'won';

export interface RifaConfig {
  mode: Mode;
  overboard: number;
  names?: string[];
  title?: string;
}

export interface Entry {
  id: string;
  name: string;
}
export interface BagEntry extends Entry {
  status: EntryStatus;
}
export interface OutStep {
  entryId: string;
  name: string;
  scene: Scene;
  startsAt: number;
}
export interface Round {
  n: number;
  onOverboard: OnOverboard;
  out: OutStep[];
  winner: { entryId: string; name: string; startsAt: number };
  endsAt: number;
}
export type WinnersItem = { kind: 'win'; round: number; entryId: string; name: string } | { kind: 'reset' };

export interface RifaState {
  mode: Mode;
  overboard: number;
  onOverboard: OnOverboard;
  opened: boolean;
  /** List mode only; ids `L0`, `L1`, … in written order. */
  entries?: Entry[];
  discarded: string[];
  won: string[];
  winners: WinnersItem[];
  rounds: number;
  round: Round | null;
}

export type RifaEvent =
  | { type: 'rifa.round'; round: Round }
  | { type: 'rifa.bag'; changes?: Record<string, EntryStatus>; reset?: true };

export interface HostSnapshot extends Pick<RifaState, 'mode' | 'overboard' | 'onOverboard' | 'opened' | 'rounds' | 'round' | 'winners'> {
  entries: BagEntry[];
}
export interface PlayerSnapshot {
  status: EntryStatus;
  round: Round | null;
  wins: number[];
}
/** What the host action `bag` returns: the bag with what a presenter screen needs to keep it honest. */
export interface BagReply extends Pick<RifaState, 'rounds' | 'round' | 'winners' | 'onOverboard'> {
  version: number;
  entries: BagEntry[];
}
export interface FinalSnapshot {
  winners: WinnersItem[];
  wins?: number[];
}

/** One name per line, trimmed, blanks dropped, repeats kept. */
export function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Names that appear more than once (case-insensitive), once each. */
export function duplicateNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  for (const n of names) {
    const k = n.toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const done = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const k = n.toLowerCase();
    if ((seen.get(k) ?? 0) > 1 && !done.has(k)) {
      done.add(k);
      out.push(n);
    }
  }
  return out;
}
