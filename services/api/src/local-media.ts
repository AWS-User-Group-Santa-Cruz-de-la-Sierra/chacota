/**
 * Local stand-in for CloudFront and presigned S3 uploads. AWS Emulator only speaks HTTPS with a
 * certificate the browser doesn't trust, so in local development the browser uploads and reads
 * media here and this server talks to the emulator.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface MediaStore {
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | undefined>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
}

const KEY = /^orgs\/[A-Za-z0-9_-]+\/media\/[A-Za-z0-9_-]+\.(webp|png|jpg)$/;
const TYPES = new Set(['image/webp', 'image/png', 'image/jpeg']);

export function localMediaRoutes(store: MediaStore, allowedOrigins: string[]) {
  const app = new Hono();
  app.use('/media/*', cors({ origin: allowedOrigins, allowMethods: ['GET', 'PUT'], allowHeaders: ['content-type'] }));

  app.get('/media/*', async (c) => {
    const key = c.req.path.slice('/media/'.length);
    const file = KEY.test(key) ? await store.get(key) : undefined;
    if (!file) return c.notFound();
    return c.body(file.body as Uint8Array<ArrayBuffer>, 200, { 'content-type': file.contentType, 'cache-control': 'no-cache' });
  });

  app.put('/media/*', async (c) => {
    const key = c.req.path.slice('/media/'.length);
    const contentType = c.req.header('content-type') ?? '';
    if (!KEY.test(key) || !TYPES.has(contentType)) return c.json({ error: 'bad_request' }, 400);
    await store.put(key, new Uint8Array(await c.req.arrayBuffer()), contentType);
    return c.json({ ok: true });
  });

  return app;
}
