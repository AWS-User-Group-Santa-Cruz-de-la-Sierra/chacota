import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { newId } from '@chacota/core';
import { ConflictError, isConditionalCheckFailure, NotFoundError, nowIso, strip, type Db } from '@chacota/db';
import { Tiluchi, type Language, type Question } from './schema';

const keys = {
  tiluchi: (orgId: string, tiluchiId: string) => ({ pk: `ORG#${orgId}`, sk: `TILUCHI#${tiluchiId}` }),
};

export interface StoredTiluchi extends Tiluchi {
  orgId: string;
  /** Incremented on every save; used for optimistic locking in the editor. */
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type TiluchiSummary = Pick<StoredTiluchi, 'id' | 'orgId' | 'title' | 'language' | 'coverImageUrl' | 'updatedAt'> & {
  questionCount: number;
};

/** DynamoDB items are capped at 400 KB; keep headroom for attribute overhead. */
export const MAX_TILUCHI_BYTES = 350_000;

function assertSize(t: Tiluchi) {
  if (new TextEncoder().encode(JSON.stringify(t)).length > MAX_TILUCHI_BYTES) {
    throw new ConflictError('Tiluchi is too large');
  }
}

export async function createTiluchi(
  db: Db,
  orgId: string,
  input: { title: string; language: Language; description?: string; questions?: Question[] },
  userId: string,
): Promise<StoredTiluchi> {
  const now = nowIso();
  const tiluchi = Tiluchi.parse({ id: newId(), questions: [], ...input });
  assertSize(tiluchi);
  const stored: StoredTiluchi = {
    ...tiluchi,
    orgId,
    version: 1,
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  await db.doc.send(
    new PutCommand({ TableName: db.tableName, Item: { ...keys.tiluchi(orgId, tiluchi.id), ...stored } }),
  );
  return stored;
}

export async function getTiluchi(db: Db, orgId: string, tiluchiId: string): Promise<StoredTiluchi | undefined> {
  const { Item } = await db.doc.send(new GetCommand({ TableName: db.tableName, Key: keys.tiluchi(orgId, tiluchiId) }));
  return Item ? strip<StoredTiluchi>(Item) : undefined;
}

export async function listTiluchis(db: Db, orgId: string): Promise<TiluchiSummary[]> {
  const { Items = [] } = await db.doc.send(
    new QueryCommand({
      TableName: db.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :t)',
      ExpressionAttributeValues: { ':pk': `ORG#${orgId}`, ':t': 'TILUCHI#' },
    }),
  );
  return Items.map((i) => strip<StoredTiluchi>(i))
    .map(({ id, orgId: o, title, language, coverImageUrl, updatedAt, questions }) => ({
      id,
      orgId: o,
      title,
      language,
      coverImageUrl,
      updatedAt,
      questionCount: questions.length,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Saves the whole tiluchi. Fails with ConflictError if someone saved in between. */
export async function saveTiluchi(
  db: Db,
  orgId: string,
  tiluchi: Tiluchi,
  expectedVersion: number,
  userId: string,
): Promise<StoredTiluchi> {
  const parsed = Tiluchi.parse(tiluchi);
  assertSize(parsed);
  const current = await getTiluchi(db, orgId, parsed.id);
  if (!current) throw new NotFoundError('Tiluchi not found');
  const stored: StoredTiluchi = {
    ...parsed,
    orgId,
    version: expectedVersion + 1,
    createdBy: current.createdBy,
    createdAt: current.createdAt,
    updatedBy: userId,
    updatedAt: nowIso(),
  };
  try {
    await db.doc.send(
      new PutCommand({
        TableName: db.tableName,
        Item: { ...keys.tiluchi(orgId, parsed.id), ...stored },
        ConditionExpression: 'version = :v',
        ExpressionAttributeValues: { ':v': expectedVersion },
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailure(error)) throw new ConflictError('Someone else saved this tiluchi');
    throw error;
  }
  return stored;
}

export async function deleteTiluchi(db: Db, orgId: string, tiluchiId: string): Promise<void> {
  await db.doc.send(new DeleteCommand({ TableName: db.tableName, Key: keys.tiluchi(orgId, tiluchiId) }));
}
