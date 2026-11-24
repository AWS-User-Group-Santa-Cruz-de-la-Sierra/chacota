import { describe, expect, it } from 'vitest';
import { visibleBottom } from '../src/web/sprite-feet';

/** RGBA pixels of a w×h image with the given rows opaque. */
function image(w: number, h: number, opaqueRows: number[]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (const y of opaqueRows) for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = 255;
  return data;
}

describe('visibleBottom', () => {
  it('finds where the drawing ends, as a fraction of the height', () => {
    expect(visibleBottom(image(4, 10, [2, 3, 4, 5, 6, 7]), 4, 10)).toBeCloseTo(0.8);
  });

  it('a drawing down to the edge ends at 1', () => {
    expect(visibleBottom(image(4, 10, [9]), 4, 10)).toBe(1);
  });

  it('ignores nearly transparent pixels (soft shadows, antialiasing)', () => {
    const data = image(4, 10, [3]);
    data[(8 * 4 + 1) * 4 + 3] = 20;
    expect(visibleBottom(data, 4, 10)).toBeCloseTo(0.4);
  });

  it('an empty image has no bottom', () => {
    expect(visibleBottom(new Uint8ClampedArray(4 * 10 * 4), 4, 10)).toBeNull();
  });
});
