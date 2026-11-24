import { describe, expect, it } from 'vitest';
import { newerVersion } from './host-version';

describe('newerVersion', () => {
  it('takes the version a host action reports when it moved the session forward', () => {
    expect(newerVersion(4, { phase: 'racing', version: 6 })).toBe(6);
  });

  it('never goes back, and ignores results without a version', () => {
    expect(newerVersion(6, { version: 5 })).toBe(6);
    expect(newerVersion(6, 3)).toBe(6);
    expect(newerVersion(6, null)).toBe(6);
    expect(newerVersion(6, { version: 'x' })).toBe(6);
  });
});
