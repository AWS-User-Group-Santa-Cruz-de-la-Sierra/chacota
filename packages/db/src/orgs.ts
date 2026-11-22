import { randomBytes } from 'node:crypto';
import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { newId, type OrgInput, type OrgStatus, type Role } from '@chacota/core';
import type { Db } from './client';
import { ConflictError, isConditionalCheckFailure, NotFoundError } from './errors';
import { epochSeconds, keys, nowIso, strip } from './keys';

export interface Org extends OrgInput {
  id: string;
  status: OrgStatus;
  logoKey?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  orgId: string;
  userId: string;
  role: Role;
  joinedAt: string;
}

export interface Invite {
  token: string;
  orgId: string;
  role: Role;
  createdBy: string;
  expiresAt: string;
}

const orgStatusIndex = (status: OrgStatus) => `ORGS#${status}`;

export async function createOrg(
  db: Db,
  input: OrgInput,
  ownerId: string,
  status: OrgStatus = 'pending',
): Promise<Org> {
  const now = nowIso();
  const org: Org = { ...input, id: newId(), status, createdBy: ownerId, createdAt: now, updatedAt: now };
  try {
    await db.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: db.tableName,
              Item: { ...keys.slug(org.slug), orgId: org.id },
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          {
            Put: {
              TableName: db.tableName,
              Item: { ...keys.org(org.id), ...org, gsi1pk: orgStatusIndex(status), gsi1sk: now },
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          { Put: { TableName: db.tableName, Item: memberItem({ orgId: org.id, userId: ownerId, role: 'owner', joinedAt: now }) } },
        ],
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailure(error)) throw new ConflictError(`Slug "${org.slug}" is already taken`);
    throw error;
  }
  return org;
}

export async function getOrg(db: Db, orgId: string): Promise<Org | undefined> {
  const { Item } = await db.doc.send(new GetCommand({ TableName: db.tableName, Key: keys.org(orgId) }));
  return Item ? strip<Org>(Item) : undefined;
}

export async function getOrgBySlug(db: Db, slug: string): Promise<Org | undefined> {
  const { Item } = await db.doc.send(new GetCommand({ TableName: db.tableName, Key: keys.slug(slug) }));
  return Item ? getOrg(db, Item.orgId as string) : undefined;
}

export async function updateOrg(
  db: Db,
  orgId: string,
  changes: Partial<Pick<Org, 'name' | 'description' | 'primaryColor' | 'websiteUrl' | 'logoKey'>>,
): Promise<Org> {
  const entries = Object.entries(changes).filter(([, v]) => v !== undefined);
  const names = Object.fromEntries(entries.map(([k], i) => [`#f${i}`, k]));
  const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]));
  const sets = entries.map((_, i) => `#f${i} = :v${i}`);
  try {
    const { Attributes } = await db.doc.send(
      new UpdateCommand({
        TableName: db.tableName,
        Key: keys.org(orgId),
        ConditionExpression: 'attribute_exists(pk)',
        UpdateExpression: `SET ${[...sets, 'updatedAt = :now'].join(', ')}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: { ...values, ':now': nowIso() },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return strip<Org>(Attributes!);
  } catch (error) {
    if (isConditionalCheckFailure(error)) throw new NotFoundError('Organization not found');
    throw error;
  }
}

export async function setOrgStatus(db: Db, orgId: string, status: OrgStatus): Promise<void> {
  try {
    await db.doc.send(
      new UpdateCommand({
        TableName: db.tableName,
        Key: keys.org(orgId),
        ConditionExpression: 'attribute_exists(pk)',
        UpdateExpression: 'SET #status = :status, gsi1pk = :g, updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status, ':g': orgStatusIndex(status), ':now': nowIso() },
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailure(error)) throw new NotFoundError('Organization not found');
    throw error;
  }
}

export async function listOrgsByStatus(db: Db, status: OrgStatus): Promise<Org[]> {
  const { Items = [] } = await db.doc.send(
    new QueryCommand({
      TableName: db.tableName,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :g',
      ExpressionAttributeValues: { ':g': orgStatusIndex(status) },
      ScanIndexForward: false,
    }),
  );
  return Items.map((i) => strip<Org>(i));
}

function memberItem(m: Membership) {
  return { ...keys.member(m.orgId, m.userId), ...m, gsi1pk: `USER#${m.userId}`, gsi1sk: `ORG#${m.orgId}` };
}

export async function getMembership(db: Db, orgId: string, userId: string): Promise<Membership | undefined> {
  const { Item } = await db.doc.send(new GetCommand({ TableName: db.tableName, Key: keys.member(orgId, userId) }));
  return Item ? strip<Membership>(Item) : undefined;
}

export async function listMembers(db: Db, orgId: string): Promise<Membership[]> {
  const { Items = [] } = await db.doc.send(
    new QueryCommand({
      TableName: db.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :m)',
      ExpressionAttributeValues: { ':pk': `ORG#${orgId}`, ':m': 'MEMBER#' },
    }),
  );
  return Items.map((i) => strip<Membership>(i));
}

export async function listOrgsForUser(db: Db, userId: string): Promise<{ org: Org; role: Role }[]> {
  const { Items = [] } = await db.doc.send(
    new QueryCommand({
      TableName: db.tableName,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :u AND begins_with(gsi1sk, :o)',
      ExpressionAttributeValues: { ':u': `USER#${userId}`, ':o': 'ORG#' },
    }),
  );
  const memberships = Items.map((i) => strip<Membership>(i));
  if (memberships.length === 0) return [];
  const orgs = new Map<string, Org>();
  for (let i = 0; i < memberships.length; i += 100) {
    const { Responses } = await db.doc.send(
      new BatchGetCommand({
        RequestItems: { [db.tableName]: { Keys: memberships.slice(i, i + 100).map((m) => keys.org(m.orgId)) } },
      }),
    );
    for (const item of Responses?.[db.tableName] ?? []) {
      const org = strip<Org>(item);
      orgs.set(org.id, org);
    }
  }
  return memberships
    .filter((m) => orgs.has(m.orgId))
    .map((m) => ({ org: orgs.get(m.orgId)!, role: m.role }))
    .sort((a, b) => a.org.name.localeCompare(b.org.name));
}

export async function setMemberRole(db: Db, orgId: string, userId: string, role: Role): Promise<void> {
  await db.doc.send(
    new PutCommand({
      TableName: db.tableName,
      Item: memberItem({ orgId, userId, role, joinedAt: (await getMembership(db, orgId, userId))?.joinedAt ?? nowIso() }),
    }),
  );
}

/** Removes a member, refusing to remove the last owner. */
export async function removeMember(db: Db, orgId: string, userId: string): Promise<void> {
  const members = await listMembers(db, orgId);
  const target = members.find((m) => m.userId === userId);
  if (!target) throw new NotFoundError('Member not found');
  if (target.role === 'owner' && members.filter((m) => m.role === 'owner').length === 1) {
    throw new ConflictError('An organization needs at least one owner');
  }
  await db.doc.send(new DeleteCommand({ TableName: db.tableName, Key: keys.member(orgId, userId) }));
}

export const INVITE_TTL_DAYS = 7;

export async function createInvite(db: Db, orgId: string, role: Role, createdBy: string): Promise<Invite> {
  const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const invite: Invite = {
    token: randomBytes(24).toString('base64url'),
    orgId,
    role,
    createdBy,
    expiresAt: expires.toISOString(),
  };
  await db.doc.send(
    new PutCommand({ TableName: db.tableName, Item: { ...keys.invite(invite.token), ...invite, ttl: epochSeconds(expires) } }),
  );
  return invite;
}

export async function getInvite(db: Db, token: string): Promise<Invite | undefined> {
  const { Item } = await db.doc.send(new GetCommand({ TableName: db.tableName, Key: keys.invite(token) }));
  if (!Item) return undefined;
  const invite = strip<Invite>(Item);
  // TTL deletion is lazy, so check expiry ourselves.
  return new Date(invite.expiresAt).getTime() > Date.now() ? invite : undefined;
}

const ROLE_RANK: Record<Role, number> = { editor: 1, admin: 2, owner: 3 };

/** Single-use: joins the org (never downgrading an existing role) and deletes the invite. */
export async function acceptInvite(db: Db, token: string, userId: string): Promise<Membership> {
  const invite = await getInvite(db, token);
  if (!invite) throw new NotFoundError('Invite not found or expired');
  const existing = await getMembership(db, invite.orgId, userId);
  const role = existing && ROLE_RANK[existing.role] >= ROLE_RANK[invite.role] ? existing.role : invite.role;
  const membership: Membership = { orgId: invite.orgId, userId, role, joinedAt: existing?.joinedAt ?? nowIso() };
  try {
    await db.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: db.tableName, Key: keys.invite(token), ConditionExpression: 'attribute_exists(pk)' } },
          { Put: { TableName: db.tableName, Item: memberItem(membership) } },
        ],
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailure(error)) throw new NotFoundError('Invite already used');
    throw error;
  }
  return membership;
}
