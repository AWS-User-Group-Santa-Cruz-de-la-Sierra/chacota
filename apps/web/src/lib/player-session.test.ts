import { describe, expect, it } from 'vitest';
import { readSessionCookie, resumeRetryDelay, SESSION_COOKIE, sessionCookie, shouldForgetSession } from './player-session';

describe('shouldForgetSession', () => {
  it('forgets the saved session only when the server says it is gone or invalid', () => {
    expect(shouldForgetSession(401)).toBe(true);
    expect(shouldForgetSession(404)).toBe(true);
  });

  it('keeps the player in the game through overload and server errors', () => {
    for (const status of [429, 500, 502, 503, 504]) expect(shouldForgetSession(status)).toBe(false);
  });
});

describe('session cookie', () => {
  const value = { token: 'a.b.c=', nickname: 'Beto; Ñandú', pin: '123456' };

  it('reads back what it wrote, among other cookies', () => {
    const written = sessionCookie(value, true).split(';')[0];
    expect(readSessionCookie(`other=1; ${written}; theme=dark`)).toEqual(value);
  });

  it('lasts as long as live data and is removed with max-age 0', () => {
    expect(sessionCookie(value, true)).toContain('Max-Age=172800');
    expect(sessionCookie(value, true)).toContain('Secure');
    expect(sessionCookie(value, false)).not.toContain('Secure');
    expect(sessionCookie(null, false)).toContain('Max-Age=0');
  });

  it('ignores a missing or broken cookie', () => {
    expect(readSessionCookie('')).toBeNull();
    expect(readSessionCookie(`${SESSION_COOKIE}=%7Bnot-json`)).toBeNull();
  });
});

describe('resumeRetryDelay', () => {
  it('backs off up to 8 seconds', () => {
    expect([0, 1, 2, 3, 4, 10].map(resumeRetryDelay)).toEqual([1000, 2000, 4000, 8000, 8000, 8000]);
  });
});
