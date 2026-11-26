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

const FRAGMENT_PREFIX = '#s=';

function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/**
 * Third copy of the phone's session, in the URL's fragment (`#s=…`). A reload, or the browser bringing
 * back a tab it had dropped, keeps the URL even where a camera app's viewer kept neither localStorage
 * nor cookies. The fragment never reaches the server and is not sent to other sites.
 */
export function sessionFragment(value: object): string {
  return FRAGMENT_PREFIX + toBase64Url(JSON.stringify(value));
}

export function readSessionFragment(hash: string): Record<string, unknown> | null {
  if (!hash.startsWith(FRAGMENT_PREFIX)) return null;
  try {
    const value: unknown = JSON.parse(fromBase64Url(hash.slice(FRAGMENT_PREFIX.length)));
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The phone's URL after saving `session`: its fragment copy, and a `?pin=` that matches it. A tab reused
 * from an earlier game keeps that game's PIN in the link when the player types the new one in the form;
 * the frame does not resume a session whose PIN differs from the link's, so a reload showed the form.
 */
export function playUrl(pathname: string, search: string, session: { pin: string } | null): string {
  if (!session) return `${pathname}${search}`;
  const params = new URLSearchParams(search);
  params.set('pin', session.pin);
  return `${pathname}?${params.toString()}${sessionFragment(session)}`;
}

/** The last nickname used on this phone, to fill in the join form. Kept apart from the session, for a year. */
export const NICKNAME_COOKIE = 'chacota_nickname';
const NICKNAME_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export function nicknameCookie(nickname: string, secure: boolean): string {
  return `${NICKNAME_COOKIE}=${encodeURIComponent(nickname)}; Path=/; Max-Age=${NICKNAME_COOKIE_MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function readNicknameCookie(cookies: string): string {
  const prefix = `${NICKNAME_COOKIE}=`;
  const raw = cookies
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix))
    ?.slice(prefix.length);
  try {
    return raw ? decodeURIComponent(raw) : '';
  } catch {
    return '';
  }
}
