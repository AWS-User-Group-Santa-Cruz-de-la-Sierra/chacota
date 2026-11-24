import { describe, expect, it } from 'vitest';
import { tileStarts } from '../src/web/race-canvas';

describe('tileStarts: repeating a texture under a moving camera', () => {
  it('covers the whole width with tiles that move with the camera', () => {
    // 100 px tiles, camera 30 px in: the first tile starts 30 px off the left edge.
    expect(tileStarts(30, 100, 250)).toEqual([-30, 70, 170]);
  });

  it('wraps around as the camera goes further', () => {
    expect(tileStarts(1030, 100, 250)).toEqual([-30, 70, 170]);
  });

  it('at the start there is no gap on the left', () => {
    expect(tileStarts(0, 100, 250)[0]).toBe(0);
  });
});
