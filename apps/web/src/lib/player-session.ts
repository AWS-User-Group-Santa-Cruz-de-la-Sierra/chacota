/**
 * Whether a failed /state response means the phone's saved session is useless. Under load the API
 * can answer 429 or 5xx for a moment: dropping the player then would cost them their place and score.
 */
export function shouldForgetSession(status: number): boolean {
  return status === 401 || status === 404;
}

/**
 * Backup copy of the phone's session. Phone camera apps open the QR link in their own viewer, where
 * localStorage may not be saved; cookies usually are, so a reload there still finds the player.
 */
export const SESSION_COOKIE = 'chacota_session';
/** Same as the 48h TTL of live data: after that the session is gone anyway. */
const SESSION_COOKIE_MAX_AGE = 48 * 60 * 60;

/** `document.cookie` value that saves `value`, or removes the cookie when it is null. */
export function sessionCookie(value: object | null, secure: boolean): string {
  const content = value ? encodeURIComponent(JSON.stringify(value)) : '';
  const maxAge = value ? SESSION_COOKIE_MAX_AGE : 0;
  return `${SESSION_COOKIE}=${content}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function readSessionCookie(cookies: string): Record<string, unknown> | null {
  const prefix = `${SESSION_COOKIE}=`;
  const raw = cookies
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix))
    ?.slice(prefix.length);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Wait before retrying /state while resuming after a reload (attempt 0 is the first retry). */
export function resumeRetryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}
