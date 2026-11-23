import { CreateTableCommand, DynamoDBClient, ResourceInUseException, UpdateTimeToLiveCommand } from '@aws-sdk/client-dynamodb';

/** Mirrors infra/lib/data.ts so local tables match the deployed one. */
export const TABLE_DEFINITION = {
  partitionKey: 'pk',
  sortKey: 'sk',
  gsi1: { name: 'gsi1', partitionKey: 'gsi1pk', sortKey: 'gsi1sk' },
  ttlAttribute: 'ttl',
} as const;

export async function createTable(client: DynamoDBClient, tableName: string): Promise<'created' | 'exists'> {
  const { partitionKey, sortKey, gsi1, ttlAttribute } = TABLE_DEFINITION;
  try {
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [partitionKey, sortKey, gsi1.partitionKey, gsi1.sortKey].map((name) => ({
          AttributeName: name,
          AttributeType: 'S',
        })),
        KeySchema: [
          { AttributeName: partitionKey, KeyType: 'HASH' },
          { AttributeName: sortKey, KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: gsi1.name,
            KeySchema: [
              { AttributeName: gsi1.partitionKey, KeyType: 'HASH' },
              { AttributeName: gsi1.sortKey, KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    );
  } catch (error) {
    if (error instanceof ResourceInUseException) return 'exists';
    throw error;
  }
  await client.send(
    new UpdateTimeToLiveCommand({
      TableName: tableName,
      TimeToLiveSpecification: { AttributeName: ttlAttribute, Enabled: true },
    }),
  );
  return 'created';
}
