import { BatchGetCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { ProfileInput } from '@chacota/core';
import type { Db } from './client';
import { keys, nowIso, strip } from './keys';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  builderProfileUrl?: string;
  locale?: 'es' | 'en';
  createdAt: string;
  updatedAt: string;
}

/** Creates the profile on first sign-in and refreshes email/avatar from the identity provider. */
export async function upsertUserFromIdentity(
  db: Db,
  identity: { id: string; email: string; name?: string; avatarUrl?: string },
): Promise<User> {
  const now = nowIso();
  const { Attributes } = await db.doc.send(
    new UpdateCommand({
      TableName: db.tableName,
      Key: keys.user(identity.id),
      UpdateExpression:
        'SET id = :id, email = :email, #name = if_not_exists(#name, :name), avatarUrl = if_not_exists(avatarUrl, :avatar), createdAt = if_not_exists(createdAt, :now), updatedAt = :now',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':id': identity.id,
        ':email': identity.email,
        ':name': identity.name?.trim() || identity.email.split('@')[0],
        ':avatar': identity.avatarUrl ?? null,
        ':now': now,
      },
      ReturnValues: 'ALL_NEW',
    }),
  );
  return strip<User>(Attributes!);
}

export async function getUser(db: Db, userId: string): Promise<User | undefined> {
  const { Item } = await db.doc.send(new GetCommand({ TableName: db.tableName, Key: keys.user(userId) }));
  return Item ? strip<User>(Item) : undefined;
}

export async function getUsers(db: Db, userIds: string[]): Promise<Map<string, User>> {
  const result = new Map<string, User>();
  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { Responses } = await db.doc.send(
      new BatchGetCommand({ RequestItems: { [db.tableName]: { Keys: chunk.map(keys.user) } } }),
    );
    for (const item of Responses?.[db.tableName] ?? []) {
      const user = strip<User>(item);
      result.set(user.id, user);
    }
  }
  return result;
}

export async function updateProfile(db: Db, userId: string, input: ProfileInput): Promise<User> {
  const { Attributes } = await db.doc.send(
    new UpdateCommand({
      TableName: db.tableName,
      Key: keys.user(userId),
      ConditionExpression: 'attribute_exists(pk)',
      UpdateExpression: `SET #name = :name, updatedAt = :now${input.locale ? ', locale = :locale' : ''} ${
        input.builderProfileUrl ? ', builderProfileUrl = :builder' : 'REMOVE builderProfileUrl'
      }`,
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':name': input.name,
        ':now': nowIso(),
        ...(input.locale ? { ':locale': input.locale } : {}),
        ...(input.builderProfileUrl ? { ':builder': input.builderProfileUrl } : {}),
      },
      ReturnValues: 'ALL_NEW',
    }),
  );
  return strip<User>(Attributes!);
}
