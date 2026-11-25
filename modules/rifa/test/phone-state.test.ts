import { describe, expect, it } from 'vitest';
import { drawRound } from '../src/bag';
import { SCENE_MS, type Entry, type OnOverboard, type RifaState, type Round } from '../src/model';
import { applyPhoneEvent, initialPhoneData, phoneView, revealedWins, type PhoneData } from '../src/web/phone-state';

const seq = (...xs: number[]) => { let i = 0; return (max: number) => xs[i++ % xs.length]! % max; };
const entries: Entry[] = ['Ana', 'Beto', 'Cata', 'Dani', 'Eli', 'Fer'].map((name, i) => ({ id: `P${i}`, name }));
const state = (onOverboard: OnOverboard, rounds = 0): RifaState => ({
  mode: 'qr', overboard: 2, onOverboard, opened: true, discarded: [], won: [], winners: [], rounds, round: null,
});
// P1 (globazo) and P3 (micro72) go overboard, then P0 wins: steps at 2.5 s, 9.5 s and 18.5 s, the end at 24.5 s.
const draw = (onOverboard: OnOverboard, rounds = 0): Round => drawRound(entries, state(onOverboard, rounds), 1_000, seq(1, 2, 1, 1, 3))!;
const endOf = (o: Round['out'][number]) => o.startsAt + SCENE_MS[o.scene];

describe('the fixture', () => {
  it('draws P1 and P3 overboard and P0 as the winner', () => {
    const r = draw('return');
    expect(r.out.map((o) => o.entryId)).toEqual(['P1', 'P3']);
    expect(r.winner.entryId).toBe('P0');
  });
});

describe('phoneView while a round plays', () => {
  const r = draw('discard');
  const [o1, o2] = r.out;

  it('a spectator sees the scene, from the wait to the winner', () => {
    for (const now of [1_000, o1!.startsAt, o2!.startsAt + 100, r.winner.startsAt, r.endsAt - 1]) {
      expect(phoneView('P2', 'bag', r, now)).toEqual({ kind: 'scene' });
    }
    // Discarded earlier, or a winner of an earlier round: still a spectator.
    expect(phoneView('P4', 'out', r, o1!.startsAt)).toEqual({ kind: 'scene' });
    expect(phoneView('P5', 'won', r, r.winner.startsAt)).toEqual({ kind: 'scene' });
  });

  it('one who goes overboard floods once their own step ends', () => {
    expect(phoneView('P1', 'out', r, endOf(o1!) - 1)).toEqual({ kind: 'scene' });
    expect(phoneView('P1', 'out', r, endOf(o1!))).toEqual({ kind: 'flood', onOverboard: 'discard' });
    expect(phoneView('P1', 'out', r, r.winner.startsAt + 10)).toEqual({ kind: 'flood', onOverboard: 'discard' });
    expect(phoneView('P3', 'out', r, endOf(o1!))).toEqual({ kind: 'scene' });
    expect(phoneView('P3', 'out', r, endOf(o2!))).toEqual({ kind: 'flood', onOverboard: 'discard' });
  });

  it('the flood says they are back in the bag when the round returns them', () => {
    const kept = draw('return');
    expect(phoneView('P1', 'bag', kept, endOf(kept.out[0]!))).toEqual({ kind: 'flood', onOverboard: 'return' });
  });

  it('the winner sees their win from the start of the winner step', () => {
    expect(phoneView('P0', 'won', r, r.winner.startsAt - 1)).toEqual({ kind: 'scene' });
    expect(phoneView('P0', 'won', r, r.winner.startsAt)).toEqual({ kind: 'won', round: 1 });
    expect(phoneView('P0', 'won', r, r.endsAt - 1)).toEqual({ kind: 'won', round: 1 });
  });

  it('a phone that reconnects with the result already marked still waits for the reveal', () => {
    // The server marks the result when it draws, so the snapshot's status is early.
    for (const now of [1_000, o1!.startsAt + 1_200]) {
      expect(phoneView('P1', 'out', r, now)).toEqual({ kind: 'scene' });
      expect(phoneView('P3', 'out', r, now)).toEqual({ kind: 'scene' });
      expect(phoneView('P0', 'won', r, now)).toEqual({ kind: 'scene' });
    }
    expect(phoneView('P3', 'out', r, o2!.startsAt + 3_000)).toEqual({ kind: 'scene' });
    expect(phoneView('P0', 'won', r, o2!.startsAt + 3_000)).toEqual({ kind: 'scene' });
  });

  it('a change made by hand shows under the flood', () => {
    // Discarded by the presenter while the round played, although the round returns them.
    const kept = draw('return');
    expect(phoneView('P1', 'out', kept, endOf(kept.out[0]!))).toEqual({ kind: 'flood', onOverboard: 'discard' });
  });
});

describe('phoneView with no round playing', () => {
  it('shows the status when there was no round yet', () => {
    expect(phoneView('P0', 'bag', null, 0)).toEqual({ kind: 'idle', status: 'bag' });
    expect(phoneView('P0', 'out', null, 0)).toEqual({ kind: 'idle', status: 'out' });
    expect(phoneView('P0', 'won', null, 0)).toEqual({ kind: 'idle', status: 'won' });
  });

  it('after the round the flood and the win stay until another one', () => {
    const r = draw('discard');
    expect(phoneView('P1', 'out', r, r.endsAt)).toEqual({ kind: 'flood', onOverboard: 'discard' });
    expect(phoneView('P3', 'out', r, r.endsAt + 60_000)).toEqual({ kind: 'flood', onOverboard: 'discard' });
    expect(phoneView('P0', 'won', r, r.endsAt)).toEqual({ kind: 'won', round: 1 });
    expect(phoneView('P2', 'bag', r, r.endsAt)).toEqual({ kind: 'idle', status: 'bag' });
    expect(phoneView('P4', 'out', r, r.endsAt)).toEqual({ kind: 'idle', status: 'out' });
    expect(phoneView('P5', 'won', r, r.endsAt)).toEqual({ kind: 'idle', status: 'won' });
  });

  it('follows the status once it changed after the round', () => {
    const r = draw('discard');
    // Put back in the bag by hand, or after a reset (the phone reloaded and still has the last round).
    expect(phoneView('P1', 'bag', r, r.endsAt)).toEqual({ kind: 'flood', onOverboard: 'return' });
    expect(phoneView('P0', 'bag', r, r.endsAt)).toEqual({ kind: 'idle', status: 'bag' });
  });
});

describe('revealedWins', () => {
  it('hides the win of the round playing until its winner step starts', () => {
    const r = draw('return', 2);
    expect(revealedWins([1, 3], r, r.winner.startsAt - 1)).toEqual([1]);
    expect(revealedWins([1, 3], r, r.winner.startsAt)).toEqual([1, 3]);
    expect(revealedWins([1, 3], r, r.endsAt)).toEqual([1, 3]);
    expect(revealedWins([1], r, 0)).toEqual([1]);
    expect(revealedWins([2], null, 0)).toEqual([2]);
  });
});

describe('phone data', () => {
  const blank = initialPhoneData({});
  const round = (d: PhoneData, r: Round, me = 'P0') => applyPhoneEvent(d, me, { type: 'rifa.round', round: r });

  it('starts in the bag with no round when the snapshot is empty', () => {
    expect(blank).toEqual({ status: 'bag', round: null, wins: [], lastRound: 0 });
    const r = draw('return');
    expect(initialPhoneData({ status: 'won', round: r, wins: [1] })).toEqual({ status: 'won', round: r, wins: [1], lastRound: 1 });
  });

  it('a round marks what the server marked when it drew', () => {
    const r = draw('discard');
    expect(round(blank, r, 'P0')).toEqual({ status: 'won', round: r, wins: [1], lastRound: 1 });
    expect(round(blank, r, 'P1')).toMatchObject({ status: 'out', wins: [] });
    expect(round(blank, r, 'P2')).toMatchObject({ status: 'bag', round: r, wins: [] });
    expect(round(blank, draw('return'), 'P1')).toMatchObject({ status: 'bag', wins: [] });
  });

  it('a round it already has is not applied again', () => {
    const r = draw('discard');
    const restored = applyPhoneEvent(round(blank, r, 'P1'), 'P1', { type: 'rifa.bag', changes: { P1: 'bag' } });
    expect(round(restored, r, 'P1')).toBe(restored);
    expect(round(initialPhoneData({ status: 'bag', round: r, wins: [] }), r, 'P1').status).toBe('bag');
  });

  it('bag changes set its own status only', () => {
    expect(applyPhoneEvent(blank, 'P0', { type: 'rifa.bag', changes: { P0: 'out', P1: 'bag' } }).status).toBe('out');
    expect(applyPhoneEvent(blank, 'P0', { type: 'rifa.bag', changes: { P1: 'out' } })).toBe(blank);
  });

  it('a reset puts it back in the bag and leaves the last round behind', () => {
    const played = round(blank, draw('discard'), 'P0');
    const reset = applyPhoneEvent(played, 'P0', { type: 'rifa.bag', reset: true });
    expect(reset).toEqual({ status: 'bag', round: null, wins: [1], lastRound: 1 });
    expect(phoneView('P0', reset.status, reset.round, 0)).toEqual({ kind: 'idle', status: 'bag' });
    // The same round, replayed late, does not come back.
    expect(round(reset, played.round!, 'P0')).toBe(reset);
  });
});
