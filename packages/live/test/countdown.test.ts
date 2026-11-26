import { describe, expect, it } from 'vitest';
import { countdownLeft } from '../src/react';

describe('countdownLeft', () => {
  it('gives what was measured for the current deadline', () => {
    expect(countdownLeft({ deadline: 5000, left: 1200 }, 5000)).toBe(1200);
  });

  it('is unknown (null) until something is measured, or without a deadline', () => {
    expect(countdownLeft(null, 5000)).toBeNull();
    expect(countdownLeft({ deadline: 5000, left: 0 }, undefined)).toBeNull();
  });

  it('never carries a measurement over to a new deadline', () => {
    // Question 1 ran out of time (0 left); question 2 then starts with a later deadline.
    // Reporting 0 there made the presenter reveal question 2 the moment it appeared.
    expect(countdownLeft({ deadline: 5000, left: 0 }, 90_000)).toBeNull();
  });
});
