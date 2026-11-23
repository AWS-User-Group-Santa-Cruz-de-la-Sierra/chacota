import { describe, expect, it } from 'vitest';
import { shouldForgetSession } from './player-session';

describe('shouldForgetSession', () => {
  it('forgets the saved session only when the server says it is gone or invalid', () => {
    expect(shouldForgetSession(401)).toBe(true);
    expect(shouldForgetSession(404)).toBe(true);
  });

  it('keeps the player in the game through overload and server errors', () => {
    for (const status of [429, 500, 502, 503, 504]) expect(shouldForgetSession(status)).toBe(false);
  });
});
