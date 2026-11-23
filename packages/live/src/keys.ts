/**
 * Players, nicknames and activity data are spread over SHARDS partition keys: DynamoDB allows about
 * 1000 writes/second per partition key, and a 1000-player session writes faster than that.
 */
export const SHARDS = 10;

export function shardOf(value: string): number {
  // FNV-1a: cheap and stable across runtimes.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % SHARDS;
}

export const pad = (n: number) => String(n).padStart(3, '0');

/** Live data (PIN, players, activity data) expires; the session record and results stay. */
export const LIVE_TTL_SECONDS = 48 * 3600;

export const sessionKeys = {
  session: (id: string) => ({ pk: `SESSION#${id}`, sk: 'META' }),
  pin: (pin: string) => ({ pk: `PIN#${pin}`, sk: 'PIN' }),
  orgSessions: (orgId: string) => `ORGSESSIONS#${orgId}`,
  playersPk: (id: string, shard: number) => `SESSION#${id}#P${shard}`,
  player: (id: string, playerId: string) => ({ pk: sessionKeys.playersPk(id, shardOf(playerId)), sk: `PLAYER#${playerId}` }),
  nickname: (id: string, nickname: string) => {
    const lower = nickname.toLocaleLowerCase();
    return { pk: `SESSION#${id}#N${shardOf(lower)}`, sk: `NICK#${lower}` };
  },
  /** Partition key for an activity's own data inside a session. */
  module: (id: string, module: string, ...parts: (string | number)[]) => [`SESSION#${id}`, module, ...parts].join('#'),
  // Results live under the organization and never expire.
  result: (orgId: string, endedAt: string, id: string) => ({ pk: `ORG#${orgId}`, sk: `RESULT#${endedAt}#${id}` }),
  resultRows: (orgId: string, id: string, chunk: number) => ({ pk: `ORG#${orgId}`, sk: `RESROWS#${id}#${pad(chunk)}` }),
};
