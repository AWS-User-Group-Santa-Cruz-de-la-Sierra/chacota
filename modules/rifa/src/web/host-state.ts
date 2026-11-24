import { isPlaying, winOf, withResetMark } from '../bag';
import type { BagEntry, BagReply, EntryStatus, RifaEvent, Round, WinnersItem } from '../model';
import { revealOf } from '../timeline';

export type BagEvent = Extract<RifaEvent, { type: 'rifa.bag' }>;

/** What the presenter's screen keeps: the bag as the server has it, the winners and the last round. */
export interface HostData {
  entries: BagEntry[];
  winners: WinnersItem[];
  rounds: number;
  round: Round | null;
}

export function advanceState(
  s: { opened: boolean; round: Round | null; inBag: number },
  now: number,
): { label: 'open' | 'draw' | 'drawing'; disabled: boolean } {
  if (!s.opened) return { label: 'open', disabled: false };
  if (isPlaying(s, now)) return { label: 'drawing', disabled: true };
  return { label: 'draw', disabled: s.inBag === 0 };
}

export function applyBagEvent(entries: BagEntry[], e: BagEvent): BagEntry[] {
  // Every status is one of bag, out or won: a reset puts everyone back.
  const after = e.reset ? entries.map((x) => (x.status === 'bag' ? x : { ...x, status: 'bag' as const })) : entries;
  const changes = e.changes;
  if (!changes) return after;
  return after.map((x) => {
    const to = changes[x.id];
    return to === undefined || to === x.status ? x : { ...x, status: to };
  });
}

/** What the server does to the bag when it draws: the winner won and, if so chosen, the out ones are discarded. */
function applyRoundEntries(entries: BagEntry[], round: Round): BagEntry[] {
  const changes: Record<string, EntryStatus> = { [round.winner.entryId]: 'won' };
  if (round.onOverboard === 'discard') for (const o of round.out) changes[o.entryId] = 'out';
  return applyBagEvent(entries, { type: 'rifa.bag', changes });
}

/**
 * Bag statuses after any event. Each event only sets statuses, so replaying the events that arrived
 * while a `bag()` fetch was in flight gives the right bag whether the fetch read before or after them.
 */
export function applyEntriesEvent(entries: BagEntry[], e: RifaEvent): BagEntry[] {
  return e.type === 'rifa.round' ? applyRoundEntries(entries, e.round) : applyBagEvent(entries, e);
}

export function applyHostEvent(d: HostData, e: RifaEvent): HostData {
  if (e.type === 'rifa.round') {
    // A snapshot taken after the draw already has this round.
    if (e.round.n <= d.rounds) return d;
    const { round } = e;
    return {
      entries: applyRoundEntries(d.entries, round),
      winners: [...d.winners, winOf(round)],
      rounds: round.n,
      round,
    };
  }
  return { ...d, entries: applyBagEvent(d.entries, e), winners: e.reset ? withResetMark(d.winners) : d.winners };
}

/**
 * Folds a `bag()` reply into the screen's data. The bag is the server's, plus the events that
 * arrived while the fetch was in flight (`missed`). A reply with a round this screen has not had an
 * event for yet (the event is still on its way) brings that round and its winner, so the result
 * stays hidden until its step, and the late event is skipped as already applied.
 */
export function applyBagReply(d: HostData, reply: Pick<BagReply, 'entries' | 'rounds' | 'round' | 'winners'>, missed: RifaEvent[]): HostData {
  const entries = missed.reduce(applyEntriesEvent, reply.entries);
  if (reply.rounds > d.rounds) return { entries, winners: reply.winners, rounds: reply.rounds, round: reply.round };
  return { ...d, entries };
}

/**
 * The bag as the audience may see it. The server marks the round's result when it draws, so while
 * the round plays each of its entries keeps its status from before the round (in the bag) until
 * its step is revealed: an out one when its scene ends, the winner from its start.
 */
export function visibleEntries(entries: BagEntry[], round: Round | null, now: number): BagEntry[] {
  if (!round || now >= round.endsAt) return entries;
  const hidden = new Map<string, EntryStatus>();
  if (now < round.winner.startsAt) hidden.set(round.winner.entryId, 'won');
  if (round.onOverboard === 'discard') for (const o of round.out) if (now < revealOf(o)) hidden.set(o.entryId, 'out');
  if (hidden.size === 0) return entries;
  // Only what the round did is hidden; a change made by hand meanwhile shows at once.
  return entries.map((x) => (hidden.get(x.id) === x.status ? { ...x, status: 'bag' as const } : x));
}

/** The winners as the audience may see them: the round's winner appears from its start. */
export function visibleWinners(winners: WinnersItem[], round: Round | null, now: number): WinnersItem[] {
  if (!round || now >= round.winner.startsAt) return winners;
  return winners.filter((w) => !(w.kind === 'win' && w.round === round.n));
}

const CHIP_STEPS = [24, 60, 120, 250];

/** Size step of the bag's chips: 0 is the largest; more entries, smaller chips. */
export function chipScale(count: number): number {
  const i = CHIP_STEPS.findIndex((max) => count <= max);
  return i === -1 ? CHIP_STEPS.length : i;
}
