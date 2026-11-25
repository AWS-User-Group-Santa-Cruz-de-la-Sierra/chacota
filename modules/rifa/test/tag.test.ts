import { describe, expect, it } from 'vitest';
import { fitTagFont, TAG_MIN_FONT, tagNeedsSqueeze } from '../src/web/scenes/tag';

describe('name tag', () => {
  it('fitTagFont shrinks long names', () => {
    expect(fitTagFont('Ana')).toBe(36);
    expect(fitTagFont('María de los Ángeles Gutiérrez')).toBeLessThan(20);
    expect(fitTagFont('x'.repeat(40))).toBe(14);
  });

  it('fitTagFont keeps 36 up to 7 characters and shrinks in proportion after that', () => {
    expect(fitTagFont('Lucía')).toBe(36);
    expect(fitTagFont('Antonio')).toBe(36);
    expect(fitTagFont('Fernanda')).toBeLessThan(36);
    expect(fitTagFont('Fernanda')).toBeGreaterThan(fitTagFont('Maximiliano'));
    expect(fitTagFont('a'.repeat(14))).toBe(18);
  });

  it('fitTagFont counts an emoji as one character and never goes below the minimum', () => {
    expect(fitTagFont('Ana 🎉🎉🎉')).toBe(36);
    expect(fitTagFont('')).toBe(36);
    expect(fitTagFont('x'.repeat(500))).toBe(TAG_MIN_FONT);
  });

  it('tagNeedsSqueeze only for names that overflow even at the minimum size', () => {
    expect(tagNeedsSqueeze('Lucía')).toBe(false);
    expect(tagNeedsSqueeze('a'.repeat(18))).toBe(false);
    expect(tagNeedsSqueeze('María de los Ángeles Gutiérrez')).toBe(true);
  });
});
