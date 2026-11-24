import { describe, expect, it } from 'vitest';
import { drawRound } from '../src/bag';
import type { RifaState } from '../src/model';
import { stepAt } from '../src/timeline';

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
});
