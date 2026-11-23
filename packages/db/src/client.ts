import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface Db {
  doc: DynamoDBDocumentClient;
  tableName: string;
}

export interface DbOptions {
  tableName: string;
  /** e.g. http://localhost:8000 for DynamoDB Local. */
  endpoint?: string;
  region?: string;
}

export function createDb({ tableName, endpoint, region }: DbOptions): Db {
  const client = new DynamoDBClient({
    region: region ?? process.env.AWS_REGION ?? 'us-east-1',
    ...(endpoint
      ? { endpoint, credentials: { accessKeyId: 'local', secretAccessKey: 'local' } }
      : {}),
  });
  const doc = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: false },
  });
  return { doc, tableName };
}

/** Reads CHACOTA_TABLE and DYNAMODB_ENDPOINT from the environment. */
export function dbFromEnv(): Db {
  const tableName = process.env.CHACOTA_TABLE;
  if (!tableName) throw new Error('CHACOTA_TABLE is not set');
  return createDb({ tableName, endpoint: process.env.DYNAMODB_ENDPOINT || undefined });
}
