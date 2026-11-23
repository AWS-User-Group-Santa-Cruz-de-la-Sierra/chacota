import { createHmac, timingSafeEqual } from 'node:crypto';

/** Player tokens: `<sessionId>.<playerId>.<hmac>`. Scoped to one session, no login needed. */
export function signPlayerToken(secret: string, sessionId: string, playerId: string): string {
  return `${sessionId}.${playerId}.${sign(secret, `${sessionId}.${playerId}`)}`;
}

export function verifyPlayerToken(secret: string, token: string): { sessionId: string; playerId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [sessionId, playerId, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(secret, `${sessionId}.${playerId}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { sessionId, playerId };
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
