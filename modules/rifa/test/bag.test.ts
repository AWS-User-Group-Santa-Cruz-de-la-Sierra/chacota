import { describe, expect, it } from 'vitest';
import { applyRound, drawRound, resetBag, setStatus, isPlaying } from '../src/bag';
import type { RifaState } from '../src/model';

const seq = (...xs: number[]) => { let i = 0; return (max: number) => xs[i++ % xs.length]! % max; };
const entries = ['Ana', 'Beto', 'Cata', 'Dani'].map((name, i) => ({ id: `L${i}`, name }));
const base: RifaState = { mode: 'list', overboard: 2, onOverboard: 'return', opened: true, entries, discarded: [], won: [], winners: [], rounds: 0, round: null };

describe('bag', () => {
  it('draws min(X, n − 1) out and one winner, all different', () => {
    const r = drawRound(entries, base, 1_000, seq(0, 0, 0, 0, 0))!;
    expect(r.out).toHaveLength(2);
    expect(new Set([...r.out.map((o) => o.entryId), r.winner.entryId]).size).toBe(3);
    expect(drawRound(entries.slice(0, 2), base, 0, seq(0))!.out).toHaveLength(1);
    expect(drawRound(entries.slice(0, 1), base, 0, seq(0))!.out).toHaveLength(0);
    expect(drawRound([], base, 0, seq(0))).toBeNull();
  });

  it('chains the steps from now + LEAD_MS', () => {
    const r = drawRound(entries, base, 1_000, seq(0, 0, 0, 0, 0))!;
    expect(r.out[0]!.startsAt).toBe(2_500);
    expect(r.out[1]!.startsAt).toBe(9_500);
    expect(r.winner.startsAt).toBe(16_500);
    expect(r.endsAt).toBe(22_500);
    expect(isPlaying({ ...base, round: r }, 22_499)).toBe(true);
    expect(isPlaying({ ...base, round: r }, 22_500)).toBe(false);
  });

  it('out ones are discarded or return as chosen', () => {
    const r = drawRound(entries, base, 0, seq(0))!;
    const outIds = r.out.map((o) => o.entryId);
    const kept = applyRound(base, r);
    expect(kept.discarded).toEqual([]);
    expect(kept.won).toEqual([r.winner.entryId]);
    expect(kept.rounds).toBe(1);
    const rd = drawRound(entries, { ...base, onOverboard: 'discard' }, 0, seq(0))!;
    const dropped = applyRound({ ...base, onOverboard: 'discard' }, rd);
    expect(dropped.discarded).toEqual(outIds);
    expect(dropped.won).toEqual([rd.winner.entryId]);
    expect(dropped.winners).toHaveLength(1);
  });

  it('winners never toggle and reset brings everyone back with one marker', () => {
    const r = drawRound(entries, base, 0, seq(0))!;
    const s = applyRound(base, r);
    expect(setStatus(s, r.winner.entryId, 'out')).toEqual(s);
    expect(setStatus(s, 'L3', 'out').discarded).toEqual(['L3']);
    expect(setStatus(setStatus(s, 'L3', 'out'), 'L3', 'bag').discarded).toEqual([]);
    const z = resetBag(s);
    expect(z.discarded).toEqual([]);
    expect(z.won).toEqual([]);
    expect(z.winners.at(-1)).toEqual({ kind: 'reset' });
    expect(resetBag(z).winners).toEqual(z.winners);
    expect(resetBag(base).winners).toEqual([]);
  });
});
