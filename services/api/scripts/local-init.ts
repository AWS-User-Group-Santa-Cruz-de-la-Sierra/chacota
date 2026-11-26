/**
 * Prepara el entorno local sobre el emulador de AWS y DynamoDB Local:
 * bucket, Cognito, tabla, org de demo, Event API y los ids para la web.
 */
process.env.AWS_ACCESS_KEY_ID ||= 'local';
process.env.AWS_SECRET_ACCESS_KEY ||= 'local';
process.env.AWS_REGION ||= 'us-east-1';

import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { AppSyncClient } from '@aws-sdk/client-appsync';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { createDb, createTable } from '@chacota/db';
import { createS3 } from '@chacota/db/s3';
import { ensureEventApi, HTTP_DNS, REALTIME_DNS } from './local/appsync';
import { DEV_EMAIL, devUserSub, E2E_EMAIL, ensureUserPool, LOCAL_PASSWORD } from './local/cognito';
import { writeEnvFiles } from './local/env-file';
import { DYNAMODB_ENDPOINT, dynamoClient, seedFresh } from './local/seed';
import { smokeCheck } from './local/smoke';

const EMULATOR = 'https://127.0.0.1:9297';
const TABLE = 'chacota-local';
const BUCKET = process.env.MEDIA_BUCKET ?? 'chacota-media-local';
const region = 'us-east-1';
const credentials = { accessKeyId: 'local', secretAccessKey: 'local' };

// 1. Bucket
const s3 = createS3({ endpoint: EMULATOR, caFile: process.env.NODE_EXTRA_CA_CERTS });
const bucketExists = await s3.send(new HeadBucketCommand({ Bucket: BUCKET })).then(() => true, () => false);
if (!bucketExists) await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
console.log(`bucket ${BUCKET} ${bucketExists ? 'ya existía' : 'creado'}`);

// 2. Cognito
const cognito = new CognitoIdentityProviderClient({ endpoint: EMULATOR, region, credentials });
const pool = await ensureUserPool(cognito);
console.log(pool.created ? 'user pool creado (user pool created)' : 'user pool reutilizado (user pool reused)');

// 3. Tabla y org de demo
const db = createDb({ tableName: TABLE, endpoint: DYNAMODB_ENDPOINT });
if (pool.created) {
  await seedFresh(db, await devUserSub(cognito, pool.userPoolId));
  console.log('tabla reiniciada (table reset)');
  console.log('org de demo cargada (demo org seeded)');
} else {
  const client = dynamoClient();
  const exists = await client.send(new DescribeTableCommand({ TableName: TABLE })).then(() => true, () => false);
  if (!exists) {
    await createTable(client, TABLE);
    console.log('tabla creada porque faltaba (la org de demo no se cargó: borrá el user pool o reiniciá el emulador)');
  } else {
    console.log('tabla existente');
  }
}

// 4. Event API
const events = await ensureEventApi(new AppSyncClient({ endpoint: EMULATOR, region, credentials }));
console.log(`Event API chacota-local lista (${events.apiId})`);

// 5. Ids para la web
writeEnvFiles({ COGNITO_USER_POOL_ID: pool.userPoolId, COGNITO_CLIENT_ID: pool.clientId, EVENTS_API_KEY: events.apiKey });
console.log('apps/web/.env.development.local y .env.production.local escritos');

// 6. Verificación
await smokeCheck({ cognito, userPoolId: pool.userPoolId, clientId: pool.clientId, apiKey: events.apiKey });
console.log('verificación ok (smoke check ok)');

// 7. Resumen
console.log(`
Listo. Entorno local:
  usuario superadmin   ${DEV_EMAIL}
  usuario e2e          ${E2E_EMAIL}
  contraseña           ${LOCAL_PASSWORD}
  emulador             ${EMULATOR}
  Events HTTP/realtime ${HTTP_DNS} / ${REALTIME_DNS}
  DynamoDB             ${DYNAMODB_ENDPOINT} (tabla ${TABLE})
  org de demo          /app/orgs/demo`);
