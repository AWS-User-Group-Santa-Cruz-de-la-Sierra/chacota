import { describe, expect, it } from 'vitest';
import { effectiveTaps, limitTaps, PHYSICS, simulate, startRunner, tripRatePerSec, zone, type Runner } from '../src/physics';

const never = () => 1;
const always = () => 0;
const every = (count: number, gapMs: number, from = 0) => Array.from({ length: count }, (_, i) => from + i * gapMs);

function seeded(seed: number) {
  // mulberry32
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Average speed over seconds 5–10 of tapping steadily, never falling. */
function cruising(tapsPerSec: number): number {
  const taps = every(tapsPerSec * 10, 1000 / tapsPerSec);
  let r: Runner = simulate(startRunner(0), taps.filter((t) => t < 5_000), 5_000, 1e9, never);
  let sum = 0;
  for (let t = 5_100; t <= 10_000; t += 100) {
    r = simulate(r, taps.filter((x) => x >= t - 100 && x < t), t, 1e9, never);
    sum += r.speed;
  }
  return sum / 49;
}

describe('physics: zones for human fingers', () => {
  it('3–4 taps/s is green, 5–6 yellow, 7–8 red', () => {
    expect(zone(cruising(3))).toBe('green');
    expect(zone(cruising(4))).toBe('green');
    expect(zone(cruising(5))).toBe('yellow');
    expect(zone(cruising(6))).toBe('yellow');
    expect(zone(cruising(7))).toBe('red');
    expect(zone(cruising(8))).toBe('red');
  });

  it('past 8 taps/s each extra tap is worth half the previous one', () => {
    expect(effectiveTaps(8)).toBe(8);
    expect(effectiveTaps(9)).toBe(8.5);
    expect(effectiveTaps(10)).toBe(8.75);
    expect(effectiveTaps(12)).toBeCloseTo(8.9375);
  });

  it('so going past 8 still helps, a little', () => {
    expect(cruising(10)).toBeGreaterThan(cruising(8));
    expect(cruising(10) - cruising(8)).toBeLessThan(cruising(8) - cruising(6));
  });

  it('red is a turbo: a tap pushes 30 % more', () => {
    const at = (speed: number) => ({ ...startRunner(0), speed });
    const gainYellow = simulate(at(10), [0], 1, 1e9, never).speed - simulate(at(10), [], 1, 1e9, never).speed;
    const gainRed = simulate(at(14), [0], 1, 1e9, never).speed - simulate(at(14), [], 1, 1e9, never).speed;
    expect(gainRed / gainYellow).toBeCloseTo(1.3, 1);
  });
});

describe('physics: falls', () => {
  it('chance of falling within one second at each speed, as agreed', () => {
    const perSecond = (speed: number) => 1 - Math.exp(-tripRatePerSec(speed));
    expect(perSecond(0)).toBe(0); // standing still
    expect(perSecond(5)).toBeCloseTo(0.02, 2); // green
    expect(perSecond(8)).toBeCloseTo(0.02, 2);
    expect(perSecond(8.01)).toBeCloseTo(0.04, 2); // yellow: 4 % …
    expect(perSecond(12.99)).toBeCloseTo(0.17, 2); // … to 17 %
    expect(perSecond(13)).toBeCloseTo(0.22, 2); // red: a flat 22 %
    expect(perSecond(18)).toBeCloseTo(0.22, 2);
  });

  it('a fall in green or yellow lasts 1–1.4 s; in red, 2.5–3.5 s', () => {
    const fallAt = (speed: number) => {
      const r = simulate({ ...startRunner(0), speed }, [], 50, 1e9, always);
      return r.downUntil;
    };
    expect(fallAt(10)).toBeGreaterThanOrEqual(PHYSICS.fallMs);
    expect(fallAt(10)).toBeLessThanOrEqual(1_400);
    expect(fallAt(15)).toBeGreaterThanOrEqual(2_500);
    expect(fallAt(15)).toBeLessThanOrEqual(3_500);
  });

  it('standing still never falls, whatever the luck', () => {
    expect(simulate(startRunner(0), [], 10_000, 10_000, always).falls).toBe(0);
  });

  it('even calm tapping in the green can trip, about 2 % of the seconds', () => {
    let seconds = 0;
    let falls = 0;
    const rng = seeded(42);
    for (let run = 0; run < 200; run++) {
      falls += simulate(startRunner(0), every(30, 333), 10_000, 10_000, rng).falls;
      seconds += 10;
    }
    expect(falls / seconds).toBeGreaterThan(0.01);
    expect(falls / seconds).toBeLessThan(0.035);
  });

  it('a fallen runner stays put and its taps do nothing', () => {
    const r = simulate(startRunner(0), every(12, 83), 600, 10_000, always);
    expect(r.falls).toBeGreaterThan(0);
    expect(r.speed).toBe(0);
    expect(r.downUntil).toBeGreaterThan(600);
  });
});

describe('physics: bookkeeping', () => {
  it('records the finish time and stops at the line', () => {
    const r = simulate(startRunner(0), every(40, 250), 10_000, 20, never);
    expect(r.finishedAt).not.toBeNull();
    expect(r.finishedAt!).toBeLessThan(10_000);
    expect(r.meters).toBe(20);
    expect(simulate(r, every(10, 100, 10_000), 12_000, 20, never)).toEqual({ ...r, t: 12_000 });
  });

  it('continues from where the last batch left off, also past 8 taps/s', () => {
    const taps = every(50, 100); // 10/s
    const once = simulate(startRunner(0), taps, 5_000, 10_000, never);
    const half = simulate(startRunner(0), taps.filter((t) => t < 2_550), 2_550, 10_000, never);
    const twice = simulate(half, taps.filter((t) => t >= 2_550), 5_000, 10_000, never);
    expect(twice.meters).toBeCloseTo(once.meters, 6);
  });

  it('limitTaps keeps at most 12 in any second (scripts)', () => {
    expect(limitTaps(every(30, 10), 12)).toHaveLength(12);
    expect(limitTaps(every(24, 84), 12)).toHaveLength(24);
    expect(limitTaps([300, 100, 200], 12)).toEqual([100, 200, 300]);
  });

  it('is deterministic for the same rng', () => {
    const taps = every(80, 125);
    const a = simulate(startRunner(0), taps, 10_000, 10_000, seeded(7));
    const b = simulate(startRunner(0), taps, 10_000, 10_000, seeded(7));
    expect(a).toEqual(b);
    expect(a.falls).toBeGreaterThan(0);
  });
});
