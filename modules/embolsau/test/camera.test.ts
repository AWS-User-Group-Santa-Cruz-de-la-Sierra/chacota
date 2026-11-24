import { describe, expect, it } from 'vitest';
import { behindCount, between, cameraX, interpolate, sampleAt, smoothCamera, VIEW_METERS, type RunnerView } from '../src/web/camera';

const runner = (patch: Partial<RunnerView> = {}): RunnerView => ({
  id: 'a', nickname: 'Ana', animal: 'jochi', bag: 0, meters: 50, speed: 8, down: false, place: 1, finished: false, at: 10_000, ...patch,
});

describe('race camera', () => {
  it('starts at 0 and follows the leader at about 75 % of the view', () => {
    expect(cameraX(0, 240)).toBe(0);
    expect(cameraX(20, 240)).toBe(0);
    expect(cameraX(120, 240)).toBeCloseTo(120 - VIEW_METERS * 0.75);
  });

  it('stops at the end of the track, with the finish line in view', () => {
    expect(cameraX(240, 240)).toBeCloseTo(240 - VIEW_METERS * 0.85);
    expect(cameraX(239, 240)).toBeLessThanOrEqual(240 - VIEW_METERS * 0.85);
  });

  it('counts who fell off the left edge', () => {
    const rs = [runner({ meters: 100 }), runner({ id: 'b', meters: 30 }), runner({ id: 'c', meters: 10 })];
    expect(behindCount(rs, 40)).toBe(2);
  });
});

describe('interpolate', () => {
  it('moves forward between updates and never backwards', () => {
    const r = runner();
    const later = interpolate(r, 10_500, 240);
    expect(later.meters).toBeGreaterThan(r.meters);
    expect(interpolate(r, 9_000, 240).meters).toBe(r.meters);
  });

  it('does not pass the finish line', () => {
    expect(interpolate(runner({ meters: 239, speed: 10 }), 20_000, 240).meters).toBe(240);
  });

  it('a fallen runner does not move', () => {
    expect(interpolate(runner({ down: true }), 10_500, 240).meters).toBe(50);
  });
});

describe('between: drawing half a second in the past, between two real updates', () => {
  const prev = [runner({ meters: 50, at: 10_000 })];
  const next = [runner({ meters: 60, at: 10_500, place: 2 })];

  it('glides evenly from the previous position to the next one', () => {
    expect(between(prev, next, 10_250, 240)[0]!.meters).toBeCloseTo(55);
    expect(between(prev, next, 10_000, 240)[0]!.meters).toBeCloseTo(50);
    expect(between(prev, next, 10_500, 240)[0]!.meters).toBeCloseTo(60);
  });

  it('takes the place and the rest from the latest update', () => {
    expect(between(prev, next, 10_100, 240)[0]!.place).toBe(2);
  });

  it('a runner that just appeared starts where it is', () => {
    expect(between([], next, 10_250, 240)[0]!.meters).toBe(60);
  });

  it('if an update is late, keeps going from the latest one instead of stopping', () => {
    const late = between(prev, next, 10_800, 240)[0]!.meters;
    expect(late).toBeGreaterThan(60);
    expect(late).toBeLessThanOrEqual(240);
  });

  it('falls and gets up halfway between the two updates', () => {
    const fall = [runner({ meters: 60, at: 10_500, down: true })];
    expect(between(prev, fall, 10_200, 240)[0]!.down).toBe(false);
    expect(between(prev, fall, 10_300, 240)[0]!.down).toBe(true);
  });
});

describe('smoothCamera', () => {
  it('moves toward the target without jumping or overshooting', () => {
    const x = smoothCamera(0, 10, 16);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(10);
    expect(smoothCamera(0, 10, 0)).toBe(0);
    expect(smoothCamera(0, 10, 5_000)).toBeCloseTo(10);
  });
});

describe('sampleAt: drawing from a short history of updates', () => {
  const snap = (at: number, meters: number) => ({ at, runners: [runner({ meters, at })] });
  const history = [snap(0, 0), snap(500, 5), snap(1000, 10)];

  it('right after an update, still glides in the previous segment (no freeze, no jump)', () => {
    // An update just arrived at 1000; drawing 600 ms behind means 400, between the first two.
    expect(sampleAt(history, 400, 240)[0]!.meters).toBeCloseTo(4);
    expect(sampleAt(history, 750, 240)[0]!.meters).toBeCloseTo(7.5);
  });

  it('is continuous across updates', () => {
    const a = sampleAt(history, 499, 240)[0]!.meters;
    const b = sampleAt(history, 501, 240)[0]!.meters;
    expect(Math.abs(b - a)).toBeLessThan(0.05);
  });

  it('before the history starts it shows the oldest update, after it keeps going', () => {
    expect(sampleAt(history, -100, 240)[0]!.meters).toBe(0);
    expect(sampleAt(history, 1200, 240)[0]!.meters).toBeGreaterThan(10);
  });

  it('an empty history draws nobody', () => {
    expect(sampleAt([], 100, 240)).toEqual([]);
  });
});
