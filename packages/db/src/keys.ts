export const keys = {
  user: (userId: string) => ({ pk: `USER#${userId}`, sk: 'PROFILE' }),
  org: (orgId: string) => ({ pk: `ORG#${orgId}`, sk: 'META' }),
  slug: (slug: string) => ({ pk: `SLUG#${slug}`, sk: 'SLUG' }),
  member: (orgId: string, userId: string) => ({ pk: `ORG#${orgId}`, sk: `MEMBER#${userId}` }),
  invite: (token: string) => ({ pk: `INVITE#${token}`, sk: 'INVITE' }),
  tiluchi: (orgId: string, tiluchiId: string) => ({ pk: `ORG#${orgId}`, sk: `TILUCHI#${tiluchiId}` }),
};

export const nowIso = () => new Date().toISOString();
export const epochSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

/** Removes the storage keys from an item before returning it to callers. */
export function strip<T>(item: Record<string, unknown>): T {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g2, ttl: _ttl, ...rest } = item;
  return rest as T;
}
