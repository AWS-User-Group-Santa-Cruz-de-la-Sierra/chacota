import { contrastRatio } from '@chacota/core';
import { describe, expect, it } from 'vitest';
import { tiluchiManifest } from '../src/manifest';

describe('tiluchi manifest', () => {
  it('lets white text read on the Tiluchi color, which is no longer the platform purple', () => {
    expect(contrastRatio(tiluchiManifest.color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(tiluchiManifest.color).not.toBe('#6B2FD6');
  });
});
