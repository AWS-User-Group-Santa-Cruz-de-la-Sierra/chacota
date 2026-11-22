import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { dbFromEnv } from '@chacota/db';
import { handle } from 'hono/aws-lambda';
import { createApi } from './api';
import { publisherFromEnv } from './realtime';
import { GameService } from './service';

let service: Promise<GameService> | undefined;

async function init(): Promise<GameService> {
  const { SecretString } = await new SecretsManagerClient({}).send(
    new GetSecretValueCommand({ SecretId: process.env.GAME_TOKEN_SECRET_ARN }),
  );
  if (!SecretString) throw new Error('Game token secret is empty');
  return new GameService(dbFromEnv(), publisherFromEnv(), { tokenSecret: SecretString });
}

const app = createApi(() => (service ??= init()), (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean));

export const handler = handle(app);
