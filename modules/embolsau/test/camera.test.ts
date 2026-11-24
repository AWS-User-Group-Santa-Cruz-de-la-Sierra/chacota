import { describe, expect, it } from 'vitest';
import { behindCount, cameraX, interpolate, VIEW_METERS, type RunnerView } from '../src/web/camera';

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
