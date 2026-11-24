import { describe, expect, it } from 'vitest';
import type { RunnerResult } from '../src/model';
import { initialPhoneState, phoneReducer } from '../src/web/play-state';

const result = (patch: Partial<RunnerResult> = {}): RunnerResult => ({
  animal: 'tatu', meters: 10, speed: 5, down: false, downUntil: 0, finished: false, place: 3, falls: 0, ...patch,
});
const phase = (patch: Record<string, unknown> = {}) =>
  ({ type: 'event', playerId: 'me', event: { type: 'embolsau.phase', phase: 'picking', round: 0, rounds: 2, phaseEndsAt: 100, raceStartedAt: null, meter: true, track: 'short', ...patch } }) as const;

describe('phone state', () => {
  it('learns the race options from the first phase event after an empty snapshot', () => {
    // The platform mounts the screen with {} right after "started".
    const s = phoneReducer(initialPhoneState({}), phase());
    expect(s).toMatchObject({ phase: 'picking', meter: true, track: 'short', inRound: true, rounds: 2 });
  });

  it('an empty snapshot is not mistaken for a late joiner', () => {
    expect(initialPhoneState({}).inRound).toBe(true);
  });

  it('takes the critter and the place from each push answer', () => {
    const s = phoneReducer(initialPhoneState({}), { type: 'push', result: result() });
    expect(s).toMatchObject({ animal: 'tatu', result: { place: 3 } });
  });

  it('remembers until when the runner is down, and a new round clears it', () => {
    let s = phoneReducer(initialPhoneState({}), { type: 'push', result: result({ down: true, downUntil: 5_000 }) });
    expect(s.downUntil).toBe(5_000);
    s = phoneReducer(s, { type: 'push', result: result({ downUntil: 4_000 }) });
    expect(s.downUntil).toBe(5_000);
    s = phoneReducer(s, phase({ phase: 'countdown', round: 2, raceStartedAt: 9_000 }));
    expect(s).toMatchObject({ downUntil: 0, result: null, inRound: true, raceStartedAt: 9_000 });
  });

  it('keeps its own rank from the round results', () => {
    const s = phoneReducer(initialPhoneState({}), {
      type: 'event',
      playerId: 'me',
      event: { type: 'embolsau.roundResults', round: 1, rounds: 2, top: [], ranks: { me: { place: 2, points: 650, total: 650 } } },
    });
    expect(s.lastRank).toEqual({ place: 2, points: 650, total: 650 });
  });

  it('a refused push for joining late shows the waiting screen', () => {
    expect(phoneReducer(initialPhoneState({}), { type: 'notInRound' }).inRound).toBe(false);
  });
});
