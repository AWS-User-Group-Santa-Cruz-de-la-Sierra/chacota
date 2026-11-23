import { describe, expect, it } from 'vitest';
import { limitTaps, PHYSICS, simulate, startRunner, tripRatePerSec, zone } from '../src/physics';

const never = () => 1;
const always = () => 0;
const every = (count: number, gapMs: number) => Array.from({ length: count }, (_, i) => i * gapMs);

function seeded(seed: number) {
  // mulberry32
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('physics', () => {
  it('a steady 6 taps/s settles in the green zone', () => {
    const r = simulate(startRunner(0), every(60, 1000 / 6), 10_000, 10_000, never);
    expect(zone(r.speed)).toBe('green');
    expect(r.meters).toBeGreaterThan(50);
  });

  it('tapping 12/s reaches red and, with bad luck, falls and stops', () => {
    const r = simulate(startRunner(0), every(24, 83), 1_500, 10_000, always);
    expect(r.falls).toBeGreaterThan(0);
    expect(r.speed).toBe(0);
    expect(r.downUntil).toBeGreaterThan(1_500);
  });

  it('never falls in the green zone, whatever the luck', () => {
    const r = simulate(startRunner(0), every(50, 200), 10_000, 10_000, always);
    expect(r.falls).toBe(0);
  });

  it('records the finish time and stops at the line', () => {
    const r = simulate(startRunner(0), every(60, 1000 / 6), 10_000, 20, never);
    expect(r.finishedAt).not.toBeNull();
    expect(r.finishedAt!).toBeLessThan(10_000);
    expect(r.meters).toBe(20);
    // Taps after the finish change nothing.
    expect(simulate(r, every(10, 100).map((t) => t + 10_000), 12_000, 20, never)).toEqual({ ...r, t: 12_000 });
  });

  it('continues from where the last batch left off', () => {
    const taps = every(30, 1000 / 6);
    const once = simulate(startRunner(0), taps, 5_000, 10_000, never);
    const half = simulate(startRunner(0), taps.filter((t) => t < 2_500), 2_500, 10_000, never);
    const twice = simulate(half, taps.filter((t) => t >= 2_500), 5_000, 10_000, never);
    expect(twice.meters).toBeCloseTo(once.meters, 6);
  });

  it('risk is zero up to the safe speed and grows past it', () => {
    expect(tripRatePerSec(PHYSICS.safeSpeed)).toBe(0);
    expect(tripRatePerSec(PHYSICS.safeSpeed + 2)).toBeGreaterThan(tripRatePerSec(PHYSICS.safeSpeed + 1));
    expect(zone(PHYSICS.safeSpeed)).toBe('green');
    expect(zone(PHYSICS.safeSpeed + 0.5)).toBe('yellow');
    expect(zone(PHYSICS.redSpeed)).toBe('red');
  });

  it('limitTaps keeps at most 12 in any second', () => {
    expect(limitTaps(every(30, 10), 12)).toHaveLength(12);
    expect(limitTaps(every(24, 84), 12)).toHaveLength(24);
    expect(limitTaps([300, 100, 200], 12)).toEqual([100, 200, 300]);
  });

  it('is deterministic for the same rng', () => {
    const taps = every(100, 90);
    const a = simulate(startRunner(0), taps, 9_000, 10_000, seeded(7));
    const b = simulate(startRunner(0), taps, 9_000, 10_000, seeded(7));
    expect(a).toEqual(b);
    expect(a.falls).toBeGreaterThan(0);
  });
});
