import { DeleteTableCommand, DynamoDBClient, ResourceNotFoundException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createOrg, createTable, setOrgActivities, type Db } from '@chacota/db';
import { createTiluchi } from '@chacota/tiluchi/content';

export const DYNAMODB_ENDPOINT = 'http://localhost:8000';

export function dynamoClient(): DynamoDBClient {
  return new DynamoDBClient({ endpoint: DYNAMODB_ENDPOINT, region: 'us-east-1', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
}

/** Borra y vuelve a crear la tabla, y deja una org de demo con un quiz de ejemplo. */
export async function seedFresh(db: Db, ownerUserId: string, userPoolId: string): Promise<void> {
  const client = dynamoClient();
  await client.send(new DeleteTableCommand({ TableName: db.tableName })).catch((error) => {
    if (!(error instanceof ResourceNotFoundException)) throw error;
  });
  await createTable(client, db.tableName);
  const org = await createOrg(db, { slug: 'demo', name: 'Chacota Demo', primaryColor: '#0B8048' }, ownerUserId, 'active');
  await setOrgActivities(db, org.id, ['tiluchi', 'embolsau']);
  await createTiluchi(
    db,
    org.id,
    {
      title: 'Trivia de ejemplo',
      language: 'es',
      questions: [
        {
          id: 'q1',
          type: 'quiz',
          prompt: '¿Qué servicio de AWS es serverless?',
          timeLimitSec: 20,
          points: 'standard',
          choices: [
            { id: 'a', text: 'Lambda', correct: true },
            { id: 'b', text: 'EC2', correct: false },
          ],
        },
        { id: 'q2', type: 'true_false', prompt: 'S3 es almacenamiento de objetos', timeLimitSec: 10, points: 'double', correct: true },
      ],
    },
    ownerUserId,
  );
  // Al final: si la corrida se corta antes, la próxima vuelve a sembrar.
  await db.doc.send(new PutCommand({ TableName: db.tableName, Item: { ...MARKER_KEY, userPoolId } }));
}

const MARKER_KEY = { pk: 'LOCAL#INIT', sk: 'META' };

/** True si la tabla ya se sembró para este user pool. */
export async function isSeededFor(db: Db, userPoolId: string): Promise<boolean> {
  try {
    const { Item } = await db.doc.send(new GetCommand({ TableName: db.tableName, Key: MARKER_KEY }));
    return Item?.userPoolId === userPoolId;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return false;
    throw error;
  }
}
