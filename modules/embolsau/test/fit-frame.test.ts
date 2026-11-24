import { describe, expect, it } from 'vitest';
import { fitFrame } from '../src/web/race-canvas';

describe('fitFrame', () => {
  it('is limited by the height on a wide, short space (a projector with header and footer)', () => {
    expect(fitFrame(1840, 880)).toEqual({ width: 1564, height: 879 });
  });

  it('is limited by the width on a tall space', () => {
    expect(fitFrame(1280, 2000)).toEqual({ width: 1280, height: 720 });
  });

  it('is empty before the space has a size', () => {
    expect(fitFrame(0, 0)).toEqual({ width: 0, height: 0 });
  });
});
