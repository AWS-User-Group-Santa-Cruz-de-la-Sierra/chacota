import { describe, expect, it } from 'vitest';
import { drawnMeters, finishSquares } from '../src/web/race-canvas';

describe('finishSquares', () => {
  it('is a two-column checkerboard: white top-left, black top-right, then the other way round', () => {
    const squares = finishSquares(100, 0, 40, 10);
    const at = (row: number, col: number) => squares.find((s) => s.y === row * 10 && s.x === 100 - 10 + col * 10)!.color;
    expect(at(0, 0)).toBe('white');
    expect(at(0, 1)).toBe('black');
    expect(at(1, 0)).toBe('black');
    expect(at(1, 1)).toBe('white');
    expect(at(2, 0)).toBe('white');
  });

  it('covers the whole track height, two squares per row', () => {
    const squares = finishSquares(100, 0, 40, 10);
    expect(squares).toHaveLength(8);
    expect(Math.max(...squares.map((s) => s.y + s.h))).toBe(40);
  });

  it('cuts the last row to the track edge', () => {
    const squares = finishSquares(100, 0, 35, 10);
    expect(Math.max(...squares.map((s) => s.y + s.h))).toBe(35);
  });
});

describe('drawnMeters', () => {
  const runner = (patch: { id?: string; meters: number; finished: boolean }) => ({ id: 'a', ...patch });

  it('a runner still racing is drawn where it is', () => {
    expect(drawnMeters(runner({ meters: 120, finished: false }), 160)).toBe(120);
  });

  it('finishers stop a few meters past the line, so they never cover it', () => {
    const m = drawnMeters(runner({ meters: 160, finished: true }), 160);
    expect(m).toBeGreaterThanOrEqual(161.5);
    expect(m).toBeLessThanOrEqual(166.5);
  });

  it('finishers spread out instead of piling up on one spot', () => {
    const spots = new Set(['a', 'b', 'c', 'd', 'e'].map((id) => drawnMeters(runner({ id, meters: 160, finished: true }), 160)));
    expect(spots.size).toBeGreaterThan(1);
  });
});
