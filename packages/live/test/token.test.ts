import { describe, expect, it } from 'vitest';
import { signPlayerToken, verifyPlayerToken } from '../src/token';

describe('player tokens', () => {
  it('round-trips and rejects tampering', () => {
    const token = signPlayerToken('s3cret', 'session-1', 'player-1');
    expect(verifyPlayerToken('s3cret', token)).toEqual({ sessionId: 'session-1', playerId: 'player-1' });
    expect(verifyPlayerToken('other', token)).toBeNull();
    expect(verifyPlayerToken('s3cret', token.replace('player-1', 'player-2'))).toBeNull();
    expect(verifyPlayerToken('s3cret', 'garbage')).toBeNull();
  });
});
