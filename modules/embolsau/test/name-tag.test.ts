import { describe, expect, it } from 'vitest';
import { nameTag, placeTags } from '../src/web/race-canvas';

describe('nameTag', () => {
  it('the top 10 show their name; the podium stands out', () => {
    expect(nameTag(1)).toEqual({ podium: true });
    expect(nameTag(3)).toEqual({ podium: true });
    expect(nameTag(4)).toEqual({ podium: false });
    expect(nameTag(10)).toEqual({ podium: false });
    expect(nameTag(11)).toBeNull();
  });
});

describe('placeTags', () => {
  const tag = (place: number, x: number, y: number) => ({ place, x, y, w: 100, h: 30 });

  it('leaves tags that do not touch where they are', () => {
    const placed = placeTags([tag(1, 0, 100), tag(2, 300, 100)]);
    expect(placed.map((t) => [t.place, t.y])).toEqual([[1, 100], [2, 100]]);
  });

  it('moves a lower place up when it would cover a better one', () => {
    const placed = placeTags([tag(2, 20, 100), tag(1, 0, 100)]);
    expect(placed.find((t) => t.place === 1)!.y).toBe(100);
    expect(placed.find((t) => t.place === 2)!.y).toBeLessThanOrEqual(100 - 30);
  });

  it('drops a non-podium name when there is no room, but never a podium one', () => {
    const crowd = [1, 2, 3, 4, 5].map((p) => tag(p, 0, 100));
    const placed = placeTags(crowd);
    for (const p of [1, 2, 3]) expect(placed.some((t) => t.place === p)).toBe(true);
    expect(placed.length).toBeLessThan(5);
  });
});
