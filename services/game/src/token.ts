import { createHmac, timingSafeEqual } from 'node:crypto';

/** Player tokens: `<gameId>.<playerId>.<hmac>`. Scoped to one game, no login needed. */
export function signPlayerToken(secret: string, gameId: string, playerId: string): string {
  return `${gameId}.${playerId}.${sign(secret, `${gameId}.${playerId}`)}`;
}

export function verifyPlayerToken(secret: string, token: string): { gameId: string; playerId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [gameId, playerId, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(secret, `${gameId}.${playerId}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { gameId, playerId };
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
