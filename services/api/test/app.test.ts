import { useTestDb } from '@chacota/db/testing';
import { LiveService, MemoryPublisher } from '@chacota/live';
import { echoActivity } from '@chacota/live/testing';
import { tiluchiActivity } from '@chacota/tiluchi/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApi } from '../src/app';

const db = useTestDb();
let live: LiveService;
let app: ReturnType<typeof createApi>;
beforeEach(() => {
  live = new LiveService(db(), new MemoryPublisher(), [tiluchiActivity, echoActivity], { tokenSecret: 'test-secret' });
  app = createApi(async () => live, [tiluchiActivity, echoActivity], ['http://localhost:3000']);
});

const post = (path: string, body: unknown, token?: string) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

describe('participant API', () => {
  it('reports health', async () => {
    expect(await (await app.request('/health')).json()).toEqual({ ok: true });
  });

  it('rejects malformed joins and unknown PINs', async () => {
    const bad = await post('/join', { pin: '12', nickname: 'Ana' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'bad_request' });
    const missing = await post('/join', { pin: '000000', nickname: 'Ana' });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'session_not_found' });
  });

  it('answers 409 session_full when the game is full', async () => {
    const session = await live.createSession({ orgId: 'o', orgName: 'UG', hostUserId: 'h', module: 'echo', content: { rounds: 1, maxPlayers: 1 } });
    await post('/join', { pin: session.pin, nickname: 'Ana' });
    const full = await post('/join', { pin: session.pin, nickname: 'Beto' });
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: 'session_full' });
  });

  it('joins, mounts each activity under /m/<id> and serves the snapshot', async () => {
    const session = await live.createSession({ orgId: 'o', orgName: 'O', hostUserId: 'h', module: 'echo', content: { rounds: 1 } });
    const joined = await post('/join', { pin: session.pin, nickname: 'Ana' });
    expect(joined.status).toBe(200);
    const { token, sessionId, module } = (await joined.json()) as { token: string; sessionId: string; module: string };
    expect([sessionId, module]).toEqual([session.id, 'echo']);

    expect((await post('/m/echo/score', {}, token)).status).toBe(200);
    const state = await app.request('/state', { headers: { authorization: `Bearer ${token}` } });
    expect(await state.json()).toMatchObject({ session: { id: session.id, module: 'echo' }, player: { nickname: 'Ana', score: 10 } });
  });

  it('requires a player token for activity routes', async () => {
    const res = await post('/m/tiluchi/answer', { questionIndex: 0, value: 'a' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_token' });
  });

  it('maps activity errors from their own routes', async () => {
    const session = await live.createSession({
      orgId: 'o', orgName: 'O', hostUserId: 'h', module: 'tiluchi',
      content: { id: 't', title: 'T', language: 'es', questions: [{ id: 'q', type: 'true_false', prompt: 'P', timeLimitSec: 10, points: 'standard', correct: true }] },
    });
    const { token } = (await (await post('/join', { pin: session.pin, nickname: 'Ana' })).json()) as { token: string };
    const res = await post('/m/tiluchi/answer', { questionIndex: 0, value: 'true' }, token);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_accepting_answers' });
  });
});
