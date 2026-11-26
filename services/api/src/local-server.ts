/**
 * Local stand-in for the participant Lambda, on :4000. Realtime events go through the AWS
 * Emulator's AppSync Events API (EVENTS_HTTP_DNS), like in the cloud.
 */
import { serve } from '@hono/node-server';
import { createDb } from '@chacota/db';
import { s3FromEnv, s3MediaStore } from '@chacota/db/s3';
import { Hono } from 'hono';
import { LiveService, publisherFromEnv } from '@chacota/live';
import { createApi } from './app';
import { localMediaRoutes } from './local-media';
import { activities } from './registry';

const API_PORT = Number(process.env.GAME_API_PORT ?? 4000);

// ---------- participant API ----------
const db = createDb({
  tableName: process.env.CHACOTA_TABLE ?? 'chacota-local',
  endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
});
const live = new LiveService(db, publisherFromEnv(), activities, {
  tokenSecret: process.env.GAME_TOKEN_SECRET ?? 'local-dev-secret',
});
const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');
// Media: the browser can't trust AWS Emulator's certificate, so it uploads and reads through here.
process.env.S3_ENDPOINT ||= 'https://127.0.0.1:9297';
const media = () => s3MediaStore(s3FromEnv(), process.env.MEDIA_BUCKET ?? 'chacota-media-local');
const app = new Hono().route('/', localMediaRoutes(media, origins)).route('/', createApi(async () => live, activities, origins));
serve({ fetch: app.fetch, port: API_PORT }, () => {
  console.log(`[participant api] http://localhost:${API_PORT}`);
  console.log(`[events] AppSync ${process.env.EVENTS_HTTP_DNS}`);
  console.log(`[media] http://localhost:${API_PORT}/media → AWS Emulator ${process.env.S3_ENDPOINT}`);
});
