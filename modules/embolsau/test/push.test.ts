import { useTestDb } from '@chacota/db/testing';
import { LiveService, MemoryPublisher } from '@chacota/live';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { EmbolsauError, pick, push } from '../src/server/runners';
import { embolsauRoutes } from '../src/server/routes';
import { bareActivity, config, never, setPhase } from './helpers';

const db = useTestDb();
let clock = 1_000_000;
let live: LiveService;
beforeEach(() => {
  clock = 1_000_000;
  live = new LiveService(db(), new MemoryPublisher(), [bareActivity], { tokenSecret: 'test-secret', now: () => clock });
});

async function racing() {
  const session = await live.createSession({ orgId: 'o', orgName: 'UG', hostUserId: 'h', module: 'embolsau', content: config });
  const ana = await live.join(session.pin, 'Ana');
  await setPhase(live, session.id, 'racing', { round: 1, raceStartedAt: clock });
  return { session, ana };
}

const sixPerSecond = [900, 733, 567, 400, 233, 67];

describe('pick and push', () => {
  it('lets a player pick an animal only while picking', async () => {
    const session = await live.createSession({ orgId: 'o', orgName: 'UG', hostUserId: 'h', module: 'embolsau', content: config });
    const ana = await live.join(session.pin, 'Ana');
    await expect(pick(live, ana.token, 'jochi')).rejects.toThrow(new EmbolsauError('not_picking'));
    await setPhase(live, session.id, 'picking');
    expect(await pick(live, ana.token, 'nandu')).toEqual({ animal: 'nandu' });
    expect((await live.getPlayer(session.id, ana.player.id))!.data).toMatchObject({ animal: 'nandu' });
  });

  it('moves the runner with server time and returns its state', async () => {
    const { ana } = await racing();
    clock += 1_000;
    const r = await push(live, ana.token, { seq: 1, ago: sixPerSecond }, never);
    expect(r.meters).toBeGreaterThan(0);
    expect(r).toMatchObject({ down: false, finished: false, falls: 0, place: null });
  });

  it('ignores replayed and out-of-order batches', async () => {
    const { ana } = await racing();
    clock += 1_000;
    await push(live, ana.token, { seq: 1, ago: sixPerSecond }, never);
    clock += 1_000;
    const second = await push(live, ana.token, { seq: 2, ago: sixPerSecond }, never);
    clock += 100;
    expect((await push(live, ana.token, { seq: 2, ago: sixPerSecond }, never)).meters).toBe(second.meters);
    expect((await push(live, ana.token, { seq: 1, ago: sixPerSecond }, never)).meters).toBe(second.meters);
  });

  it('drops taps outside the race window', async () => {
    const { ana } = await racing();
    clock += 300;
    // Every tap happened during the countdown, before the start.
    expect((await push(live, ana.token, { seq: 1, ago: [2000, 1500, 1000, 500] }, never)).meters).toBe(0);
  });

  it('rejects push outside racing', async () => {
    const session = await live.createSession({ orgId: 'o', orgName: 'UG', hostUserId: 'h', module: 'embolsau', content: config });
    const ana = await live.join(session.pin, 'Ana');
    await setPhase(live, session.id, 'countdown', { round: 1 });
    await expect(push(live, ana.token, { seq: 1, ago: [] })).rejects.toThrow(new EmbolsauError('not_racing'));
  });

  it('rejects a player who joined after the start', async () => {
    const { session } = await racing();
    clock += 500;
    const late = await live.join(session.pin, 'Tarde');
    await expect(push(live, late.token, { seq: 1, ago: [] })).rejects.toThrow(new EmbolsauError('not_in_round'));
  });

  it('caps taps a script sends', async () => {
    const { session, ana } = await racing();
    const beto = await live.join(session.pin, 'Beto');
    // Beto joined at the same instant the race started: still in the round.
    clock += 1_000;
    const burst = Array.from({ length: 40 }, (_, i) => 999 - i * 2);
    const script = await push(live, beto.token, { seq: 1, ago: burst }, never);
    // Only the first 12 taps of the burst count: the same as sending just those.
    const capped = await push(live, ana.token, { seq: 1, ago: burst.slice(0, 12) }, never);
    expect(script.meters).toBeCloseTo(capped.meters, 6);
  });

  it('validates input on the routes', async () => {
    const { ana } = await racing();
    const app = new Hono();
    embolsauRoutes(app, async () => live);
    const post = (body: unknown) =>
      app.request('/push', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${ana.token}` }, body: JSON.stringify(body) });
    expect((await post({ seq: 1, ago: [5000] })).status).toBe(400);
    expect((await post({ seq: 1, ago: Array.from({ length: 41 }, () => 10) })).status).toBe(400);
    expect((await post({ seq: 1, ago: [10] })).status).toBe(200);
    const pickRes = await app.request('/pick', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${ana.token}` }, body: JSON.stringify({ animal: 'jochi' }) });
    expect(pickRes.status).toBe(409);
    expect(await pickRes.json()).toEqual({ error: 'not_picking' });
  });
});
