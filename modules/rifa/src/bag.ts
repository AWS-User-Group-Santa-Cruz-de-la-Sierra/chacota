import { LEAD_MS, SCENES, SCENE_MS, WINNER_MS, type BagEntry, type Entry, type OutStep, type Round, type RifaState } from './model';

/** Integer in [0, max). */
export type RandomInt = (max: number) => number;

export function bagEntries(entries: Entry[], state: Pick<RifaState, 'discarded' | 'won'>): BagEntry[] {
  const won = new Set(state.won);
  const out = new Set(state.discarded);
  return entries.map((e) => ({ ...e, status: won.has(e.id) ? 'won' : out.has(e.id) ? 'out' : 'bag' }));
}

export function drawRound(pool: Entry[], state: RifaState, now: number, randomInt: RandomInt): Round | null {
  if (pool.length === 0) return null;
  const k = Math.min(state.overboard, pool.length - 1);
  const a = [...pool];
  // Partial Fisher–Yates: the first k+1 slots hold the picks.
  for (let i = 0; i <= k; i++) {
    const j = i + randomInt(a.length - i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  let t = now + LEAD_MS;
  const out: OutStep[] = [];
  for (let i = 0; i < k; i++) {
    const e = a[i]!;
    const scene = SCENES[randomInt(SCENES.length)]!;
    out.push({ entryId: e.id, name: e.name, scene, startsAt: t });
    t += SCENE_MS[scene];
  }
  const w = a[k]!;
  return {
    n: state.rounds + 1,
    onOverboard: state.onOverboard,
    out,
    winner: { entryId: w.id, name: w.name, startsAt: t },
    endsAt: t + WINNER_MS,
  };
}

export function applyRound(state: RifaState, round: Round): RifaState {
  const discarded = round.onOverboard === 'discard' ? [...state.discarded, ...round.out.map((o) => o.entryId)] : state.discarded;
  return {
    ...state,
    won: [...state.won, round.winner.entryId],
    discarded,
    winners: [...state.winners, { kind: 'win', round: round.n, entryId: round.winner.entryId, name: round.winner.name }],
    rounds: round.n,
    round,
  };
}

export function setStatus(state: RifaState, entryId: string, to: 'bag' | 'out'): RifaState {
  if (state.won.includes(entryId)) return state;
  const rest = state.discarded.filter((id) => id !== entryId);
  return { ...state, discarded: to === 'out' ? [...rest, entryId] : rest };
}

export function resetBag(state: RifaState): RifaState {
  const last = state.winners[state.winners.length - 1];
  const winners = last === undefined || last.kind === 'reset' ? state.winners : [...state.winners, { kind: 'reset' as const }];
  return { ...state, discarded: [], won: [], winners };
}

export function isPlaying(state: Pick<RifaState, 'round'>, now: number): boolean {
  return state.round !== null && now < state.round.endsAt;
}
