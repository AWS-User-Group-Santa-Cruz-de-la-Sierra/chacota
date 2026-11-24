import { describe, expect, it } from 'vitest';
import { drawRound } from '../src/bag';
import { SCENE_MS, type BagEntry, type RifaEvent, type RifaState, type Round, type WinnersItem } from '../src/model';
import {
  advanceState,
  applyBagEvent,
  applyBagReply,
  applyEntriesEvent,
  applyHostEvent,
  chipScale,
  nextBoundary,
  visibleEntries,
  visibleWinners,
  type HostData,
} from '../src/web/host-state';

const seq = (...xs: number[]) => { let i = 0; return (max: number) => xs[i++ % xs.length]! % max; };
const names = ['Ana', 'Beto', 'Cata', 'Dani', 'Eli', 'Fer'];
const bag = (): BagEntry[] => names.map((name, i) => ({ id: `L${i}`, name, status: 'bag' }));
const state = (onOverboard: 'discard' | 'return'): RifaState => ({
  mode: 'list', overboard: 2, onOverboard, opened: true, discarded: [], won: [], winners: [], rounds: 0, round: null,
});
// Picks L1 and L3 out (globazo, micro72), then L0 wins: steps at 2.5 s, 9.5 s and 18.5 s, the end at 24.5 s.
const draw = (onOverboard: 'discard' | 'return', rounds = 0): Round =>
  drawRound(bag(), { ...state(onOverboard), rounds }, 1_000, seq(1, 2, 1, 1, 3))!;
const statusOf = (entries: BagEntry[]) => Object.fromEntries(entries.map((e) => [e.id, e.status]));

describe('advanceState', () => {
  const r = draw('return');
  it('opens a rifa that is not open yet', () => {
    expect(advanceState({ opened: false, round: null, inBag: 4 }, 0)).toEqual({ label: 'open', disabled: false });
  });
  it('is busy while a round plays', () => {
    expect(advanceState({ opened: true, round: r, inBag: 4 }, r.endsAt - 1)).toEqual({ label: 'drawing', disabled: true });
  });
  it('cannot draw from an empty bag', () => {
    expect(advanceState({ opened: true, round: r, inBag: 0 }, r.endsAt)).toEqual({ label: 'draw', disabled: true });
  });
  it('draws otherwise', () => {
    expect(advanceState({ opened: true, round: null, inBag: 4 }, 0)).toEqual({ label: 'draw', disabled: false });
    expect(advanceState({ opened: true, round: r, inBag: 4 }, r.endsAt)).toEqual({ label: 'draw', disabled: false });
  });
});

describe('applyBagEvent', () => {
  it('applies the changed statuses', () => {
    const next = applyBagEvent(bag(), { type: 'rifa.bag', changes: { L1: 'out', L9: 'out' } });
    expect(statusOf(next)).toMatchObject({ L0: 'bag', L1: 'out', L2: 'bag' });
    expect(next).toHaveLength(names.length);
    expect(statusOf(applyBagEvent(next, { type: 'rifa.bag', changes: { L1: 'bag' } })).L1).toBe('bag');
  });
  it('reset puts winners and discarded back in the bag', () => {
    const mixed = bag().map((e, i) => ({ ...e, status: i === 0 ? 'won' : i === 1 ? 'out' : 'bag' }) as BagEntry);
    expect(applyBagEvent(mixed, { type: 'rifa.bag', reset: true }).every((e) => e.status === 'bag')).toBe(true);
  });
});

describe('applyHostEvent', () => {
  const empty: HostData = { entries: bag(), winners: [], rounds: 0, round: null };

  it('a round marks its winner and, when discarding, its out ones', () => {
    const r = draw('discard');
    const d = applyHostEvent(empty, { type: 'rifa.round', round: r });
    expect(statusOf(d.entries)).toMatchObject({ L0: 'won', L1: 'out', L3: 'out', L2: 'bag' });
    expect(d.winners).toEqual([{ kind: 'win', round: 1, entryId: 'L0', name: 'Ana' }]);
    expect(d.rounds).toBe(1);
    expect(d.round).toBe(r);
    const kept = applyHostEvent(empty, { type: 'rifa.round', round: draw('return') });
    expect(statusOf(kept.entries)).toMatchObject({ L0: 'won', L1: 'bag', L3: 'bag' });
  });

  it('a round the snapshot already has is not applied twice', () => {
    const r = draw('return');
    const once = applyHostEvent(empty, { type: 'rifa.round', round: r });
    const restored = { ...once, entries: applyBagEvent(once.entries, { type: 'rifa.bag', changes: { L1: 'out' } }) };
    expect(applyHostEvent(restored, { type: 'rifa.round', round: r })).toEqual(restored);
  });

  it('a reset leaves a mark in the winners, once', () => {
    const played = applyHostEvent(empty, { type: 'rifa.round', round: draw('return') });
    const reset = applyHostEvent(played, { type: 'rifa.bag', reset: true });
    expect(reset.winners.at(-1)).toEqual({ kind: 'reset' });
    expect(reset.entries.every((e) => e.status === 'bag')).toBe(true);
    expect(applyHostEvent(reset, { type: 'rifa.bag', reset: true }).winners).toEqual(reset.winners);
    expect(applyHostEvent(empty, { type: 'rifa.bag', reset: true }).winners).toEqual([]);
  });
});

describe('applyEntriesEvent', () => {
  it('replays what arrived while the bag was being fetched', () => {
    const r = draw('discard');
    const events: RifaEvent[] = [{ type: 'rifa.round', round: r }, { type: 'rifa.bag', changes: { L1: 'bag' } }];
    // The fetch read the bag before the round, or after both events: the replay ends the same.
    const before = events.reduce(applyEntriesEvent, bag());
    const after = events.reduce(applyEntriesEvent, applyBagEvent(applyEntriesEvent(bag(), events[0]!), { type: 'rifa.bag', changes: { L1: 'bag' } }));
    expect(statusOf(before)).toEqual(statusOf(after));
    expect(statusOf(before)).toMatchObject({ L0: 'won', L1: 'bag', L3: 'out' });
  });
});

describe('applyBagReply', () => {
  const empty: HostData = { entries: bag(), winners: [], rounds: 0, round: null };

  it('a reply that has a round before its event hides it, and the late event changes nothing', () => {
    const r = draw('discard');
    // What the server has once it drew: the reply reads it before the rifa.round event arrives.
    const server = applyHostEvent(empty, { type: 'rifa.round', round: r });
    const replied = applyBagReply(empty, { entries: server.entries, rounds: 1, round: r, winners: server.winners }, []);
    expect(replied).toEqual(server);
    expect(statusOf(visibleEntries(replied.entries, replied.round, 1_000))).toMatchObject({ L0: 'bag', L1: 'bag', L3: 'bag' });
    expect(visibleWinners(replied.winners, replied.round, 1_000)).toEqual([]);
    expect(applyHostEvent(replied, { type: 'rifa.round', round: r })).toBe(replied);
  });

  it('a reply read before a round that arrived meanwhile keeps the round and replays it over the bag', () => {
    const r = draw('discard');
    const d = applyHostEvent(empty, { type: 'rifa.round', round: r });
    const joined: BagEntry[] = [...bag(), { id: 'L6', name: 'Gabo', status: 'bag' }];
    const replied = applyBagReply(d, { entries: joined, rounds: 0, round: null, winners: [] }, [{ type: 'rifa.round', round: r }]);
    expect(replied.round).toBe(r);
    expect(replied.rounds).toBe(1);
    expect(replied.winners).toBe(d.winners);
    expect(statusOf(replied.entries)).toMatchObject({ L0: 'won', L1: 'out', L3: 'out', L6: 'bag' });
  });
});

describe('visibleEntries (no spoilers)', () => {
  const r = draw('discard');
  const after = applyHostEvent({ entries: bag(), winners: [], rounds: 0, round: null }, { type: 'rifa.round', round: r }).entries;
  const [o1, o2] = r.out;
  const endOf = (o: typeof o1) => o!.startsAt + SCENE_MS[o!.scene];

  it('shows everyone in the bag until each step is revealed', () => {
    expect(statusOf(visibleEntries(after, r, 1_000))).toMatchObject({ L0: 'bag', L1: 'bag', L3: 'bag' });
    expect(statusOf(visibleEntries(after, r, endOf(o1) - 1))).toMatchObject({ L1: 'bag', L3: 'bag', L0: 'bag' });
  });
  it('an out one changes when its scene ends', () => {
    expect(statusOf(visibleEntries(after, r, endOf(o1)))).toMatchObject({ L1: 'out', L3: 'bag', L0: 'bag' });
    expect(statusOf(visibleEntries(after, r, endOf(o2) - 1))).toMatchObject({ L1: 'out', L3: 'bag', L0: 'bag' });
  });
  it('the winner changes from its start', () => {
    expect(statusOf(visibleEntries(after, r, r.winner.startsAt - 1)).L0).toBe('bag');
    expect(statusOf(visibleEntries(after, r, r.winner.startsAt))).toMatchObject({ L0: 'won', L1: 'out', L3: 'out' });
    expect(visibleEntries(after, r, r.endsAt)).toBe(after);
  });
  it('leaves alone what the round did not change', () => {
    const kept = draw('return');
    const keptAfter = applyHostEvent({ entries: bag(), winners: [], rounds: 0, round: null }, { type: 'rifa.round', round: kept }).entries;
    // Discarded by hand during the round: shown at once, it was not the round's doing.
    const byHand = applyBagEvent(keptAfter, { type: 'rifa.bag', changes: { L1: 'out' } });
    expect(statusOf(visibleEntries(byHand, kept, 1_000))).toMatchObject({ L0: 'bag', L1: 'out' });
    expect(visibleEntries(after, null, 1_000)).toBe(after);
  });
});

describe('visibleWinners (no spoilers)', () => {
  const r = draw('return', 1);
  const before: WinnersItem[] = [{ kind: 'win', round: 1, entryId: 'L5', name: 'Fer' }, { kind: 'reset' }];
  const winners = applyHostEvent({ entries: bag(), winners: before, rounds: 1, round: null }, { type: 'rifa.round', round: r }).winners;

  it('adds the new winner only from its start', () => {
    expect(visibleWinners(winners, r, r.winner.startsAt - 1)).toEqual(before);
    expect(visibleWinners(winners, r, r.winner.startsAt)).toEqual(winners);
    expect(visibleWinners(winners, r, r.endsAt)).toEqual(winners);
    expect(visibleWinners(winners, null, 0)).toEqual(winners);
  });
});

describe('nextBoundary', () => {
  it('walks every step start, reveal and the end, then stops', () => {
    const r = draw('discard');
    const [o1, o2] = r.out;
    expect(nextBoundary(r, 1_000)).toBe(o1!.startsAt);
    expect(nextBoundary(r, o1!.startsAt)).toBe(o2!.startsAt);
    expect(nextBoundary(r, o2!.startsAt)).toBe(r.winner.startsAt);
    expect(nextBoundary(r, r.winner.startsAt)).toBe(r.endsAt);
    expect(nextBoundary(r, r.endsAt)).toBeUndefined();
    expect(nextBoundary(null, 0)).toBeUndefined();
  });
});

describe('chipScale', () => {
  it('shrinks the chips as the bag grows, down to the smallest size', () => {
    expect(chipScale(6)).toBe(0);
    expect(chipScale(60)).toBeGreaterThan(chipScale(6));
    expect(chipScale(300)).toBeGreaterThan(chipScale(60));
    expect(chipScale(1000)).toBe(chipScale(300));
  });
});
