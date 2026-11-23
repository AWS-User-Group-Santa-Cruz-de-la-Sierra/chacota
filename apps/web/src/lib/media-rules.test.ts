import { describe, expect, it } from 'vitest';
import { checkUpload } from './media-rules';

describe('checkUpload', () => {
  it.each([
    [{ contentType: 'image/webp', size: 1000 }, null],
    [{ contentType: 'image/svg+xml', size: 1000 }, 'bad_type'],
    [{ contentType: '', size: 1000 }, 'bad_type'],
    [{ contentType: 'image/png', size: 0 }, 'empty'],
    [{ contentType: 'image/png', size: 2_097_153 }, 'too_big'],
    [{ contentType: 'image/png', size: 2_097_152 }, null],
    [{ contentType: 'image/jpeg', size: Number.NaN }, 'empty'],
  ])('checkUpload(%o) → %s', (input, expected) => expect(checkUpload(input)).toBe(expected));
});
