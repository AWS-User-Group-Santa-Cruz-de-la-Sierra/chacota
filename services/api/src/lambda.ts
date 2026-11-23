import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { dbFromEnv } from '@chacota/db';
import { LiveService, publisherFromEnv } from '@chacota/live';
import { handle } from 'hono/aws-lambda';
import { createApi } from './app';
import { activities } from './registry';

let live: Promise<LiveService> | undefined;

async function init(): Promise<LiveService> {
  const { SecretString } = await new SecretsManagerClient({}).send(
    new GetSecretValueCommand({ SecretId: process.env.GAME_TOKEN_SECRET_ARN }),
  );
  if (!SecretString) throw new Error('Player token secret is empty');
  return new LiveService(dbFromEnv(), publisherFromEnv(), activities, { tokenSecret: SecretString });
}

const app = createApi(() => (live ??= init()), activities, (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean));

export const handler = handle(app);
