/**
 * Local stand-in for the cloud: the participant API (like the Lambda) on :4000 and an
 * AppSync Events-compatible broker on :4001 (HTTP publish + WebSocket subscribe).
 */
import { createServer } from 'node:http';
import { serve } from '@hono/node-server';
import { createDb } from '@chacota/db';
import { s3FromEnv, s3MediaStore } from '@chacota/db/s3';
import { Hono } from 'hono';
import { WebSocketServer, type WebSocket } from 'ws';
import { LiveService, LocalPublisher } from '@chacota/live';
import { createApi } from './app';
import { localMediaRoutes } from './local-media';
import { activities } from './registry';

const API_PORT = Number(process.env.GAME_API_PORT ?? 4000);
const BROKER_PORT = Number(process.env.EVENTS_PORT ?? 4001);

// ---------- broker ----------
const subscribers = new Map<WebSocket, Map<string, string>>(); // socket → (subscription id → channel)

function deliver(channel: string, events: string[]) {
  let delivered = 0;
  for (const [socket, subs] of subscribers) {
    for (const [id, subscribed] of subs) {
      if (subscribed !== channel) continue;
      for (const event of events) socket.send(JSON.stringify({ type: 'data', id, event }));
      delivered++;
    }
  }
  return delivered;
}

const broker = createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/event') {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    try {
      const { channel, events } = JSON.parse(body) as { channel: string; events: string[] };
      deliver(channel, events);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ successful: events.length }));
    } catch {
      res.writeHead(400).end();
    }
  });
});

const wss = new WebSocketServer({ server: broker, path: '/event/realtime', handleProtocols: () => 'aws-appsync-event-ws' });
wss.on('connection', (socket) => {
  subscribers.set(socket, new Map());
  const keepAlive = setInterval(() => socket.send(JSON.stringify({ type: 'ka' })), 60_000);
  socket.on('message', (raw) => {
    const msg = JSON.parse(String(raw)) as { type: string; id?: string; channel?: string };
    if (msg.type === 'connection_init') socket.send(JSON.stringify({ type: 'connection_ack', connectionTimeoutMs: 300_000 }));
    if (msg.type === 'subscribe' && msg.id && msg.channel) {
      subscribers.get(socket)!.set(msg.id, msg.channel);
      socket.send(JSON.stringify({ type: 'subscribe_success', id: msg.id }));
    }
    if (msg.type === 'unsubscribe' && msg.id) {
      subscribers.get(socket)!.delete(msg.id);
      socket.send(JSON.stringify({ type: 'unsubscribe_success', id: msg.id }));
    }
  });
  socket.on('close', () => {
    clearInterval(keepAlive);
    subscribers.delete(socket);
  });
});
broker.listen(BROKER_PORT, () => console.log(`[events] ws://localhost:${BROKER_PORT}/event/realtime`));

// ---------- participant API ----------
const db = createDb({
  tableName: process.env.CHACOTA_TABLE ?? 'chacota-local',
  endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
});
const live = new LiveService(db, new LocalPublisher(`http://localhost:${BROKER_PORT}`), activities, {
  tokenSecret: process.env.GAME_TOKEN_SECRET ?? 'local-dev-secret',
});
const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');
// Media: the browser can't trust AWS Emulator's certificate, so it uploads and reads through here.
process.env.S3_ENDPOINT ||= 'https://127.0.0.1:9297';
const media = () => s3MediaStore(s3FromEnv(), process.env.MEDIA_BUCKET ?? 'chacota-media-local');
const app = new Hono().route('/', localMediaRoutes(media, origins)).route('/', createApi(async () => live, activities, origins));
serve({ fetch: app.fetch, port: API_PORT }, () => {
  console.log(`[participant api] http://localhost:${API_PORT}`);
  console.log(`[media] http://localhost:${API_PORT}/media → AWS Emulator ${process.env.S3_ENDPOINT}`);
});
