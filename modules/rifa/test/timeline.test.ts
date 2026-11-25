import { describe, expect, it } from 'vitest';
import { drawRound } from '../src/bag';
import { SCENE_MS, type RifaState } from '../src/model';
import { nextBoundary, revealOf, stepAt } from '../src/timeline';

const entries = ['Ana', 'Beto', 'Cata', 'Dani'].map((name, i) => ({ id: `L${i}`, name }));
const base: RifaState = { mode: 'list', overboard: 2, onOverboard: 'return', opened: true, entries, discarded: [], won: [], winners: [], rounds: 0, round: null };
const r = drawRound(entries, base, 1_000, () => 0)!;

describe('timeline', () => {
  it('stepAt jumps into the running step', () => {
    expect(stepAt(r, r.out[1]!.startsAt + 1_200)).toEqual({ kind: 'out', index: 1, elapsed: 1_200 });
    expect(stepAt(r, r.winner.startsAt + 10)).toEqual({ kind: 'winner', elapsed: 10 });
  });

  it('stepAt before startsAt waits and after endsAt is done', () => {
    expect(stepAt(r, 1_000)).toEqual({ kind: 'waiting', inMs: 1_500 });
    expect(stepAt(r, r.endsAt)).toEqual({ kind: 'done' });
    const solo = drawRound(entries.slice(0, 1), base, 0, () => 0)!;
    expect(stepAt(solo, solo.winner.startsAt)).toEqual({ kind: 'winner', elapsed: 0 });
    expect(stepAt(solo, 0).kind).toBe('waiting');
  });

  it('stepAt follows uneven scene durations', () => {
    const seq = (...xs: number[]) => { let i = 0; return (max: number) => xs[i++ % xs.length]! % max; };
    const u = drawRound(entries, base, 0, seq(2, 0, 1, 3, 0))!;
    expect(stepAt(u, 10_499)).toEqual({ kind: 'out', index: 0, elapsed: 8_999 });
    expect(stepAt(u, 10_500)).toEqual({ kind: 'out', index: 1, elapsed: 0 });
    expect(stepAt(u, 17_500)).toEqual({ kind: 'winner', elapsed: 0 });
  });

  it('revealOf is the end of the step scene, whatever its length', () => {
    expect(revealOf(r.out[0]!)).toBe(r.out[0]!.startsAt + SCENE_MS.retrete);
    const seq = (...xs: number[]) => { let i = 0; return (max: number) => xs[i++ % xs.length]! % max; };
    const u = drawRound(entries, base, 0, seq(2, 0, 1, 3, 0))!;
    expect(u.out.map((o) => o.scene)).toEqual(['micro72', 'retrete']);
    expect(revealOf(u.out[0]!)).toBe(10_500);
    expect(revealOf(u.out[1]!)).toBe(u.winner.startsAt);
  });

  it('nextBoundary walks every step start, reveal and the end, then stops', () => {
    const [o1, o2] = r.out;
    expect(nextBoundary(r, 1_000)).toBe(o1!.startsAt);
    expect(nextBoundary(r, o1!.startsAt)).toBe(revealOf(o1!));
    expect(nextBoundary(r, o1!.startsAt + 1)).toBe(o2!.startsAt);
    expect(nextBoundary(r, o2!.startsAt)).toBe(r.winner.startsAt);
    expect(nextBoundary(r, r.winner.startsAt)).toBe(r.endsAt);
    expect(nextBoundary(r, r.endsAt)).toBeUndefined();
    expect(nextBoundary(null, 0)).toBeUndefined();
  });
});
