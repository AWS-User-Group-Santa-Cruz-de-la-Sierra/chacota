import { describe, expect, it } from 'vitest';
import { estimateMinutes } from '../src/content/estimate';

describe('estimateMinutes', () => {
  it('adds each time limit plus reading, answer and ranking time, rounded up', () => {
    // 12 questions of 20 s: 12 × (20 + 20) = 480 s = 8 min, as in the lobby mockup.
    expect(estimateMinutes(Array.from({ length: 12 }, () => ({ timeLimitSec: 20 })))).toBe(8);
    expect(estimateMinutes([{ timeLimitSec: 30 }])).toBe(1);
    expect(estimateMinutes([{ timeLimitSec: 60 }, { timeLimitSec: 60 }])).toBe(3);
  });

  it('is zero without questions', () => {
    expect(estimateMinutes([])).toBe(0);
  });
});
