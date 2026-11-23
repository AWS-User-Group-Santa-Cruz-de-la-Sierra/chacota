import { describe, expect, it } from 'vitest';
import { contrastRatio, readableTextColor } from '../src/color';

describe('contrast', () => {
  it('matches WCAG for black on white', () => expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0));

  it.each(['#FFFF00', '#808080', '#6B2FD6', '#0B8048', '#FBF8FF', '#1A0E2E', '#777777'])('%s gets text with ≥ 4.5:1', (bg) => {
    expect(contrastRatio(bg, readableTextColor(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('uses white on the Chacota purple and black on yellow', () => {
    expect(readableTextColor('#6B2FD6')).toBe('#FFFFFF');
    expect(readableTextColor('#FFC629')).toBe('#000000');
  });
});
