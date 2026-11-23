import { describe, expect, it } from 'vitest';
import { localMediaRoutes, type MediaStore } from '../src/local-media';

function memoryStore(): MediaStore {
  const files = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    async get(key) {
      return files.get(key);
    },
    async put(key, body, contentType) {
      files.set(key, { body, contentType });
    },
  };
}

const KEY = 'orgs/o1/media/abc.webp';

describe('local media proxy', () => {
  it('stores an upload and serves it back with its type', async () => {
    const app = localMediaRoutes(memoryStore(), ['http://localhost:3000']);
    const put = await app.request(`/media/${KEY}`, { method: 'PUT', headers: { 'content-type': 'image/webp' }, body: new Uint8Array([1, 2, 3]) });
    expect(put.status).toBe(200);
    const get = await app.request(`/media/${KEY}`);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/webp');
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('answers 404 for a missing file', async () => {
    const app = localMediaRoutes(memoryStore(), []);
    expect((await app.request(`/media/${KEY}`)).status).toBe(404);
  });

  it('refuses keys outside orgs/<id>/media and non-image types', async () => {
    const app = localMediaRoutes(memoryStore(), []);
    const badKey = await app.request('/media/tmp/x.webp', { method: 'PUT', headers: { 'content-type': 'image/webp' }, body: 'x' });
    expect(badKey.status).toBe(400);
    const badType = await app.request(`/media/${KEY}`, { method: 'PUT', headers: { 'content-type': 'image/svg+xml' }, body: 'x' });
    expect(badType.status).toBe(400);
  });

  it('lets the web app upload from the browser (CORS preflight)', async () => {
    const app = localMediaRoutes(memoryStore(), ['http://localhost:3000']);
    const res = await app.request(`/media/${KEY}`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'content-type' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(res.headers.get('access-control-allow-methods')).toContain('PUT');
  });
});
