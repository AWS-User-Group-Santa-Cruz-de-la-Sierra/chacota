import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { createTable } from '../src/table';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const tableName = process.env.CHACOTA_TABLE ?? 'chacota-local';
const client = new DynamoDBClient({
  endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const result = await createTable(client, tableName);
console.log(`Table ${tableName} ${result} at ${endpoint}`);
