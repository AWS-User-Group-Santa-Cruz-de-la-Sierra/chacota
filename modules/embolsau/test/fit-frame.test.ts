import { describe, expect, it } from 'vitest';
import { fitFrame, FRAME, MAX_FRAME_HEIGHT, MIN_FRAME_HEIGHT } from '../src/web/race-canvas';

describe('fitFrame', () => {
  it('fills a wide box whole: the drawing takes its shape', () => {
    // A 1080p projector once the presenter frame's header and footer take their part.
    const fit = fitFrame(1840, 832);
    expect(fit).toMatchObject({ width: 1840, height: 832 });
    expect(fit.frameHeight).toBeCloseTo((832 * FRAME.width) / 1840);
  });

  it('fills a box taller than 16:9 too (a 16:10 laptop, a window)', () => {
    const fit = fitFrame(1400, 900);
    expect(fit).toMatchObject({ width: 1400, height: 900 });
    expect(fit.frameHeight).toBeGreaterThan(FRAME.height);
  });

  it('keeps a margin only past the limits, and then shrinks to fit', () => {
    const short = fitFrame(2000, 500);
    expect(short.frameHeight).toBe(MIN_FRAME_HEIGHT);
    expect(short.height).toBe(500);
    expect(short.width).toBe(Math.round((500 * FRAME.width) / MIN_FRAME_HEIGHT));
    const tall = fitFrame(1000, 2000);
    expect(tall.frameHeight).toBe(MAX_FRAME_HEIGHT);
    expect(tall.width).toBe(1000);
  });

  it('is empty before the box has a size', () => {
    expect(fitFrame(0, 0)).toEqual({ width: 0, height: 0, frameHeight: FRAME.height });
  });
});
