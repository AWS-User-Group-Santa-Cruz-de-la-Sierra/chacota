import { describe, expect, it } from 'vitest';
import {
  nicknameCookie,
  readNicknameCookie,
  readSessionCookie,
  readSessionFragment,
  resumeRetryDelay,
  SESSION_COOKIE,
  sessionCookie,
  sessionFragment,
  shouldForgetSession,
} from './player-session';

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

describe('session in the URL fragment', () => {
  const value = { token: 'sess.player.sig-_=', sessionId: 'sess', module: 'embolsau', playerId: 'player', nickname: 'Ñandú 🏃', pin: '123456' };

  it('reads back what it wrote, so a reload resumes without localStorage or cookies', () => {
    const hash = sessionFragment(value);
    expect(hash).toMatch(/^#s=[A-Za-z0-9_-]+$/); // nothing that needs escaping in a URL
    expect(readSessionFragment(hash)).toEqual(value);
  });

  it('ignores other fragments and broken ones', () => {
    expect(readSessionFragment('')).toBeNull();
    expect(readSessionFragment('#top')).toBeNull();
    expect(readSessionFragment('#s=%%%')).toBeNull();
    expect(readSessionFragment('#s=bm90LWpzb24')).toBeNull(); // "not-json"
  });
});

describe('last nickname', () => {
  it('is kept for a year, apart from the session, and read back among other cookies', () => {
    const cookie = nicknameCookie('Beto; Ñandú', true);
    expect(cookie).toContain('Max-Age=31536000');
    expect(cookie).toContain('Secure');
    expect(readNicknameCookie(`a=1; ${cookie.split(';')[0]}; b=2`)).toBe('Beto; Ñandú');
  });

  it('is empty when there is none', () => {
    expect(readNicknameCookie('a=1')).toBe('');
  });
});
