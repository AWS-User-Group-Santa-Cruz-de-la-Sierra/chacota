import { useTestDb } from '@chacota/db/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LiveError, LiveService, MemoryPublisher, playerCode } from '../src';
import { echoActivity } from '../src/testing/echo-activity';

const db = useTestDb();
let clock = 1_000_000;
let publisher: MemoryPublisher;
let live: LiveService;
beforeEach(() => {
  publisher = new MemoryPublisher();
  live = new LiveService(db(), publisher, [echoActivity], { tokenSecret: 'test-secret', now: () => clock });
});

const newSession = (orgId = 'org1', rounds = 2) =>
  live.createSession({ orgId, orgName: 'AWS UG', hostUserId: 'host', module: 'echo', content: { rounds } });

describe('LiveService', () => {
  it('runs a session of any activity', async () => {
    const session = await newSession();
    expect(session).toMatchObject({ module: 'echo', title: 'Echo 2', status: 'lobby', version: 1 });
    expect(session.roomId).toBeUndefined();
    expect(session.pin).toMatch(/^\d{6}$/);

    const ana = await live.join(session.pin, '  Ana  ');
    const beto = await live.join(session.pin, 'Beto');
    expect(ana).toMatchObject({ sessionId: session.id, module: 'echo', player: { nickname: 'Ana' } });

    await live.advance(session.id); // started + round 1
    await live.addScore(session.id, ana.player.id, 10);
    await live.advance(session.id); // round 2
    const ended = await live.advance(session.id); // no more rounds → end
    expect(ended.status).toBe('ended');

    expect(publisher.events.map((e) => e.event.type)).toEqual([
      'player_joined',
      'player_joined',
      'started',
      'echo.round',
      'echo.round',
      'ended',
    ]);
    expect(publisher.last('ended')).toMatchObject({
      podium: [{ nickname: 'Ana', score: 10 }, { nickname: 'Beto', score: 0 }],
      ranks: { [ana.player.id]: { rank: 1, score: 10 }, [beto.player.id]: { rank: 2, score: 0 } },
    });

    const results = await live.getResults(ended);
    expect(results).toMatchObject({ sessionId: session.id, module: 'echo', title: 'Echo 2', playerCount: 2 });
    expect(results!.columns.map((c) => c.key)).toEqual(['rounds']);
    expect(results!.standings[0]).toEqual({ rank: 1, nickname: 'Ana', code: playerCode(ana.player.id), score: 10, extra: { rounds: 2 } });
    expect(results!.details).toEqual({ rounds: 2 });

    // Ending twice is harmless.
    await live.end(session.id);
    expect((await live.listResults('org1')).filter((r) => r.sessionId === session.id)).toHaveLength(1);
  });

  it('gives reconnecting clients a snapshot with the activity part', async () => {
    const session = await newSession();
    const ana = await live.join(session.pin, 'Ana');
    await live.advance(session.id);
    const snapshot = await live.snapshot(session.id, ana.player.id);
    expect(snapshot).toMatchObject({
      session: { id: session.id, status: 'running', module: 'echo', title: 'Echo 2' },
      player: { id: ana.player.id, nickname: 'Ana', score: 0 },
      module: { round: 1 },
      serverNow: clock,
    });
  });

  it('rejects duplicate nicknames regardless of case', async () => {
    const session = await newSession();
    await live.join(session.pin, 'Tiluchi');
    await expect(live.join(session.pin, 'tiluchi')).rejects.toThrow(new LiveError('nickname_taken'));
  });

  it('rejects forged tokens and unknown PINs', async () => {
    expect(() => live.verifyToken('a.b.c')).toThrow(new LiveError('invalid_token'));
    await expect(live.join('000000', 'X')).rejects.toThrow(new LiveError('session_not_found'));
  });

  it('lets one of two racing advances win', async () => {
    const session = await newSession();
    await live.join(session.pin, 'Uno');
    const results = await Promise.allSettled([live.advance(session.id), live.advance(session.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: new LiveError('invalid_transition') });
  });

  it('ignores an advance based on a screen that is already out of date', async () => {
    const session = await newSession();
    await live.join(session.pin, 'Uno');
    const started = await live.advance(session.id, session.version); // round 1
    // A double click: the second press still carries the version the screen showed.
    await expect(live.advance(session.id, session.version)).rejects.toThrow(new LiveError('invalid_transition'));
    expect((await live.getSession<{ round: number }>(session.id))!.state.round).toBe(1);
    await live.advance(session.id, started.version); // round 2
    expect((await live.snapshot(session.id)).session.version).toBe((await live.getSession(session.id))!.version);
  });

  it('refuses unknown activities and unplayable content', async () => {
    await expect(
      live.createSession({ orgId: 'o', orgName: 'O', hostUserId: 'h', module: 'nope', content: {} }),
    ).rejects.toThrow(new LiveError('unknown_activity'));
    await expect(newSession('o', 0)).rejects.toThrow(new LiveError('not_playable'));
  });

  it('keeps results newest first, skips empty sessions, lists unfinished ones', async () => {
    const orgId = 'org-results';
    const empty = await newSession(orgId);
    await live.end(empty.id);

    const first = await newSession(orgId);
    await live.join(first.pin, 'Uno');
    await live.advance(first.id);
    expect(await live.listUnfinishedSessions(orgId)).toMatchObject([{ id: first.id }]);
    clock += 1000;
    await live.end(first.id);

    const second = await newSession(orgId);
    await live.join(second.pin, 'Dos');
    clock += 1000;
    await live.end(second.id); // still in the lobby

    const list = await live.listResults(orgId);
    expect(list.map((r) => r.sessionId)).toEqual([second.id, first.id]);
    expect(list[0]).not.toHaveProperty('standings');
    expect(await live.listUnfinishedSessions(orgId)).toEqual([]);
  });

  it('still lists results whose activity is no longer registered', async () => {
    const session = await newSession('org-gone');
    await live.join(session.pin, 'Ana');
    await live.end(session.id);
    const without = new LiveService(db(), publisher, [], { tokenSecret: 'test-secret', now: () => clock });
    expect((await without.listResults('org-gone')).map((r) => r.module)).toEqual(['echo']);
    const stored = await without.getSession(session.id);
    expect((await without.getResults(stored!))?.standings).toHaveLength(1);
  });
});

describe('concurrency', () => {
  it('lets many players join at once', async () => {
    const session = await newSession();
    const results = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => live.join(session.pin, `p${i}`)));
    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
    expect((await live.getSession(session.id))?.playerCount).toBe(40);
  });

  it('stores results of big sessions in chunks', async () => {
    const session = await newSession();
    const n = 1100;
    for (let i = 0; i < n; i += 100) {
      await Promise.all(Array.from({ length: Math.min(100, n - i) }, (_, j) => live.join(session.pin, `jugador-${i + j}`)));
    }
    const results = await live.getResults(await live.end(session.id));
    expect(results!.standings).toHaveLength(n);
    expect(new Set(results!.standings.map((r) => r.nickname)).size).toBe(n);
  }, 60_000);
});
