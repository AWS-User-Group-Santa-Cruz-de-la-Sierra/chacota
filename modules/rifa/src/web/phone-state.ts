import { SCENE_MS, type EntryStatus, type OnOverboard, type OutStep, type PlayerSnapshot, type RifaEvent, type Round } from '../model';

export type PhoneView =
  | { kind: 'idle'; status: EntryStatus }
  | { kind: 'scene' }
  | { kind: 'flood'; onOverboard: OnOverboard }
  | { kind: 'won'; round: number };

/** What the phone keeps: its entry's status as the server has it, the last round and its wins. */
export interface PhoneData {
  status: EntryStatus;
  /** The round to play or to stay on; null before the first one and after a reset. */
  round: Round | null;
  wins: number[];
  /** Number of the last round applied, so a round replayed late is not applied twice. */
  lastRound: number;
}

/** When an "al agua" step is revealed: the end of its scene. */
export const revealOf = (o: OutStep) => o.startsAt + SCENE_MS[o.scene];

// The line under the flood follows the status: it is the round's choice unless the presenter
// changed it by hand.
const flood = (status: EntryStatus): PhoneView => ({ kind: 'flood', onOverboard: status === 'out' ? 'discard' : 'return' });

/**
 * What the phone shows. The server marks a round's result when it draws, so while the round plays
 * the status may already say it: the round's timeline decides instead. One who goes overboard
 * floods once their own step ends, the winner sees the win from the winner step, everyone else
 * watches the scene. After the round the flood and the win stay until the next one.
 */
export function phoneView(playerId: string, status: EntryStatus, round: Round | null, now: number): PhoneView {
  if (!round) return { kind: 'idle', status };
  const out = round.out.find((o) => o.entryId === playerId);
  const isWinner = round.winner.entryId === playerId;
  if (now < round.endsAt) {
    if (out && now >= revealOf(out)) return flood(status);
    if (isWinner && now >= round.winner.startsAt) return { kind: 'won', round: round.n };
    return { kind: 'scene' };
  }
  if (out && status !== 'won') return flood(status);
  // A winner back in the bag was reset (a phone that reloaded still has the last round).
  if (isWinner && status === 'won') return { kind: 'won', round: round.n };
  return { kind: 'idle', status };
}

/** The wins the phone may show: the one of the round playing counts from its winner step. */
export function revealedWins(wins: number[], round: Round | null, now: number): number[] {
  if (!round || now >= round.winner.startsAt) return wins;
  return wins.filter((n) => n !== round.n);
}

export function initialPhoneData(s: Partial<PlayerSnapshot>): PhoneData {
  const round = s.round ?? null;
  return { status: s.status ?? 'bag', round, wins: s.wins ?? [], lastRound: round?.n ?? 0 };
}

export function applyPhoneEvent(d: PhoneData, playerId: string, e: RifaEvent): PhoneData {
  if (e.type === 'rifa.round') {
    const { round } = e;
    // A snapshot read after the draw already has this round.
    if (round.n <= d.lastRound) return d;
    // What the server marked when it drew: the winner won and, if so chosen, the out ones are discarded.
    const won = round.winner.entryId === playerId;
    const discarded = round.onOverboard === 'discard' && round.out.some((o) => o.entryId === playerId);
    return {
      status: won ? 'won' : discarded ? 'out' : d.status,
      round,
      wins: won ? [...d.wins, round.n] : d.wins,
      lastRound: round.n,
    };
  }
  // A reset puts everyone back in the bag, and the phone stops showing the last round.
  const after = e.reset ? { ...d, status: 'bag' as const, round: null } : d;
  const to = e.changes?.[playerId];
  return to === undefined || to === after.status ? after : { ...after, status: to };
}
