import { DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { afterAll, beforeAll } from 'vitest';
import { createDb, type Db } from '../src/client';
import { createTable } from '../src/table';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';

/** Gives each test file its own table in DynamoDB Local (start it with `podman compose up -d`). */
export function useTestDb(): () => Db {
  const tableName = `chacota-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const client = new DynamoDBClient({
    endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  const db = createDb({ tableName, endpoint });
  beforeAll(async () => {
    await createTable(client, tableName);
  });
  afterAll(async () => {
    await client.send(new DeleteTableCommand({ TableName: tableName }));
  });
  return () => db;
}
