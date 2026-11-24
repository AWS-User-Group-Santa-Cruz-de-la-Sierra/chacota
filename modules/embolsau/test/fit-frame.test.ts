import { describe, expect, it } from 'vitest';
import { fitFrame, FRAME, MIN_FRAME_HEIGHT } from '../src/web/race-canvas';

describe('fitFrame', () => {
  it('keeps the full width on a wide, short space: the drawing gets shorter, not smaller', () => {
    // A 1080p projector once the presenter frame's header and footer take their part.
    const fit = fitFrame(1840, 832);
    expect(fit.width).toBe(1840);
    expect(fit.height).toBe(832);
    expect(fit.frameHeight).toBeCloseTo((832 * FRAME.width) / 1840);
  });

  it('is 16:9 at most, limited by the width on a tall space', () => {
    expect(fitFrame(1280, 2000)).toEqual({ width: 1280, height: 720, frameHeight: FRAME.height });
  });

  it('stops getting shorter at the minimum height, and then shrinks to fit', () => {
    const fit = fitFrame(2000, 600);
    expect(fit.frameHeight).toBe(MIN_FRAME_HEIGHT);
    expect(fit.height).toBe(600);
    expect(fit.width).toBe(Math.floor((600 * FRAME.width) / MIN_FRAME_HEIGHT));
  });

  it('is empty before the space has a size', () => {
    expect(fitFrame(0, 0)).toEqual({ width: 0, height: 0, frameHeight: FRAME.height });
  });
});
