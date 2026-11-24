import { useTestDb } from '@chacota/db/testing';
import { channels, LiveError, LiveService, MemoryPublisher, type JoinResult } from '@chacota/live';
import { beforeEach, describe, expect, it } from 'vitest';
import { CLOSING_MS, COUNTDOWN_MS, PICK_MS, ROUND_MAX_MS, TRACK_METERS, type EmbolsauConfig } from '../src/model';
import { PHYSICS } from '../src/physics';
import { embolsauActivity, pick, pointsFor, push } from '../src/server';
import { never } from './helpers';

const db = useTestDb();
let clock = 1_000_000;
let publisher: MemoryPublisher;
let live: LiveService;
beforeEach(() => {
  clock = 1_000_000;
  publisher = new MemoryPublisher();
  live = new LiveService(db(), publisher, [embolsauActivity], { tokenSecret: 'test-secret', now: () => clock });
});

const base: EmbolsauConfig = { meter: true, track: 'short', rounds: 1, maxPlayers: 100 };
const newRace = (config: Partial<EmbolsauConfig> = {}) =>
  live.createSession({ orgId: 'o', orgName: 'UG', hostUserId: 'h', module: 'embolsau', content: { ...base, ...config } });
const tick = (id: string) => live.hostAction(id, 'tick', undefined) as Promise<{ phase: string; version: number }>;
const state = async (id: string) => (await live.getSession<{ phase: string; round: number; phaseEndsAt: number | null }>(id))!;

const ended = async (id: string) => (await state(id)).status === 'ended';
/** The race is over and waits on the big screen; the presenter's button moves on. */
async function finishedThenNext(id: string) {
  expect((await state(id)).state.phase).toBe('finished');
  await live.advance(id);
}
/** The order of the last round, from the history (the last round goes straight to the podium). */
async function lastRoundTop(id: string) {
  const results = (await live.getResults((await live.getSession(id))!))!;
  return (results.details as { rounds: { top: { playerId: string; place: number; points: number }[] }[] }).rounds.at(-1)!.top;
}
const placeOf = (top: { playerId: string; place: number; points: number }[], id: string) => top.find((p) => p.playerId === id)!;

/** Starts the session, lets everybody pick, and ticks until the race is on. */
async function toRace(id: string) {
  await live.advance(id); // lobby → picking
  clock += PICK_MS;
  await tick(id); // → countdown
  clock += COUNTDOWN_MS;
  await tick(id); // → racing
}

/** Each second: the pushers send `rate` taps, then the presenter ticks. */
async function runSeconds(id: string, seconds: number, pushers: { p: JoinResult; rate: number }[], seqs: Map<string, number>) {
  for (let s = 0; s < seconds; s++) {
    clock += 1_000;
    for (const { p, rate } of pushers) {
      const seq = (seqs.get(p.player.id) ?? 0) + 1;
      seqs.set(p.player.id, seq);
      const ago = Array.from({ length: rate }, (_, i) => Math.round(((i + 0.5) * 1000) / rate));
      await push(live, p.token, { seq, ago }, never).catch(() => undefined);
    }
    await tick(id);
  }
}

describe('Embolsau activity', () => {
  it('plays a full 2-round race', async () => {
    const session = await newRace({ rounds: 2 });
    const [ana, beto, cata] = [await live.join(session.pin, 'Ana'), await live.join(session.pin, 'Beto'), await live.join(session.pin, 'Cata')];
    await live.advance(session.id);
    expect((await state(session.id)).state).toMatchObject({ phase: 'picking', phaseEndsAt: clock + PICK_MS });
    await pick(live, ana.token, 'jochi');
    await pick(live, beto.token, 'capibara');
    await tick(session.id);
    expect(publisher.events.find((e) => e.event.type === 'embolsau.picks')).toMatchObject({
      channel: channels.host(session.id),
      event: { counts: { jochi: 1, tatu: 0, nandu: 0, capibara: 1 }, picked: 2 },
    });

    clock += PICK_MS;
    await tick(session.id);
    expect((await state(session.id)).state).toMatchObject({ phase: 'countdown', round: 1 });
    expect((await live.getPlayer(session.id, cata.player.id))!.data?.animal).toBeDefined();
    clock += COUNTDOWN_MS;
    await tick(session.id);
    expect((await state(session.id)).state.phase).toBe('racing');

    const seqs = new Map<string, number>();
    await runSeconds(session.id, 45, [{ p: ana, rate: 6 }, { p: beto, rate: 4 }], seqs);
    await finishedThenNext(session.id);
    expect((await state(session.id)).state.phase).toBe('roundResults');
    const r1 = publisher.last('embolsau.roundResults')!;
    const ranks = r1.ranks as Record<string, { place: number; points: number; total: number }>;
    expect(ranks[ana.player.id]).toMatchObject({ place: 1, points: 1000, total: 1000 });
    expect(ranks[cata.player.id]).toMatchObject({ place: 3, points: 0 });
    expect(ranks[beto.player.id]!.points).toBeGreaterThan(0);
    expect(ranks[beto.player.id]!.points).toBeLessThan(1000);

    await live.advance(session.id); // round 2 countdown
    expect((await state(session.id)).state).toMatchObject({ phase: 'countdown', round: 2 });
    clock += COUNTDOWN_MS;
    await tick(session.id);
    await runSeconds(session.id, 45, [{ p: beto, rate: 6 }, { p: ana, rate: 5 }], seqs);
    await finishedThenNext(session.id);
    // The last race goes straight to the podium: no round ranking to spoil it.
    expect(await ended(session.id)).toBe(true);
    expect(publisher.events.filter((e) => e.event.type === 'embolsau.roundResults')).toHaveLength(1); // only the first race
    expect(publisher.events.some((e) => e.event.type === 'embolsau.phase' && e.event.phase === 'roundResults' && e.event.round === 2)).toBe(false);
    expect(publisher.last('ended')!.podium[0]!.nickname).toBe('Ana');
    const results = (await live.getResults((await live.getSession(session.id))!))!;
    expect(results.columns.map((c) => c.key)).toEqual(['bestTime', 'meters', 'falls', 'animal']);
    expect(results.standings.map((s) => s.nickname)).toEqual(['Ana', 'Beto', 'Cata']);
    expect(results.standings[0]!.extra).toMatchObject({ animal: 'Jochi', falls: 0 }); // the name people read, not the id
    expect(results.standings[0]!.extra.bestTime).toBeGreaterThan(0);
    expect((results.details as { rounds: unknown[] }).rounds).toHaveLength(2);
  });

  it('standings go only to the host channel', async () => {
    const session = await newRace();
    const ana = await live.join(session.pin, 'Ana');
    await toRace(session.id);
    await runSeconds(session.id, 2, [{ p: ana, rate: 6 }], new Map());
    const standings = publisher.events.filter((e) => e.event.type === 'embolsau.standings');
    expect(standings.length).toBeGreaterThan(0);
    expect(standings.every((e) => e.channel === channels.host(session.id))).toBe(true);
    // The phone learns its place in the push answer instead.
    const answer = await push(live, ana.token, { seq: 99, ago: [] }, never);
    expect(answer.place).toBe(1);
  });

  it('everybody is at the start line from the countdown, before any phone pushes', async () => {
    const session = await newRace();
    await live.join(session.pin, 'Ana');
    await live.join(session.pin, 'Beto');
    await live.advance(session.id); // lobby → picking
    clock += PICK_MS;
    await tick(session.id); // → countdown
    publisher.events.length = 0;
    clock += 500;
    await tick(session.id); // still counting down
    expect((await state(session.id)).state.phase).toBe('countdown');
    const standings = publisher.last('embolsau.standings')!;
    expect((standings.runners as { nickname: string; meters: number }[]).map((r) => [r.nickname, r.meters])).toEqual([
      ['Ana', 0],
      ['Beto', 0],
    ]);
  });

  it('the third finisher opens the 10 s closing', async () => {
    const session = await newRace();
    const players = [];
    for (const n of ['A', 'B', 'C', 'D']) players.push(await live.join(session.pin, n));
    await toRace(session.id);
    const seqs = new Map<string, number>();
    const fast = players.slice(0, 3).map((p) => ({ p, rate: 6 }));
    for (let s = 0; s < 40 && (await state(session.id)).state.phase === 'racing'; s++) await runSeconds(session.id, 1, fast, seqs);
    const s = (await state(session.id)).state;
    expect(s.phase).toBe('closing');
    expect(s.phaseEndsAt).toBe(clock + CLOSING_MS);
    clock += CLOSING_MS;
    await tick(session.id);
    await finishedThenNext(session.id);
    expect(await ended(session.id)).toBe(true);
  });

  it('closes at the time limit when nobody finishes', async () => {
    const session = await newRace();
    const ana = await live.join(session.pin, 'Ana');
    const beto = await live.join(session.pin, 'Beto');
    await toRace(session.id);
    await runSeconds(session.id, 3, [{ p: ana, rate: 5 }, { p: beto, rate: 3 }], new Map());
    clock += ROUND_MAX_MS.short;
    await tick(session.id);
    await finishedThenNext(session.id);
    expect(await ended(session.id)).toBe(true);
    const top = await lastRoundTop(session.id);
    expect(placeOf(top, ana.player.id).place).toBe(1);
    expect(placeOf(top, ana.player.id).points).toBeLessThan(300);
    expect(placeOf(top, beto.player.id).points).toBeLessThan(placeOf(top, ana.player.id).points);
  });

  it('late joiner waits for the next round', async () => {
    const session = await newRace({ rounds: 2 });
    const ana = await live.join(session.pin, 'Ana');
    await toRace(session.id);
    clock += 500;
    const late = await live.join(session.pin, 'Tarde');
    await runSeconds(session.id, 2, [{ p: ana, rate: 6 }], new Map());
    clock += ROUND_MAX_MS.short;
    await tick(session.id);
    await finishedThenNext(session.id);
    const r1 = publisher.last('embolsau.roundResults')!.ranks as Record<string, unknown>;
    expect(r1[late.player.id]).toBeUndefined();
    await live.advance(session.id);
    clock += COUNTDOWN_MS;
    await tick(session.id);
    expect((await push(live, late.token, { seq: 1, ago: [100] }, never)).meters).toBeGreaterThanOrEqual(0);
  });

  it('closes right away when the last runner finishes during the closing', async () => {
    const session = await newRace();
    const players = [];
    for (const n of ['A', 'B', 'C', 'D']) players.push(await live.join(session.pin, n));
    await toRace(session.id);
    const seqs = new Map<string, number>();
    const all = players.map((p, i) => ({ p, rate: i < 3 ? 6 : 5 }));
    for (let s = 0; s < 40 && (await state(session.id)).state.phase !== 'finished'; s++) await runSeconds(session.id, 1, all, seqs);
    // D (5 taps/s) arrives a few seconds after the third: well before the 10 s closing ends.
    await finishedThenNext(session.id);
    expect(await ended(session.id)).toBe(true);
    expect(placeOf(await lastRoundTop(session.id), players[3]!.player.id).place).toBe(4);
    const closingAt = publisher.events.findIndex((e) => e.event.type === 'embolsau.phase' && e.event.phase === 'closing');
    const resultsAt = publisher.events.findIndex((e) => e.event.type === 'embolsau.phase' && e.event.phase === 'finished');
    const ticksBetween = publisher.events.slice(closingAt, resultsAt).filter((e) => e.event.type === 'embolsau.standings').length;
    expect(ticksBetween).toBeLessThan(7); // the full closing would be 9 ticks
  });

  it('every phone learns its critter, and late joiners get one for the next round', async () => {
    const session = await newRace({ rounds: 2 });
    const ana = await live.join(session.pin, 'Ana');
    await toRace(session.id); // Ana never picked: she gets one at random
    clock += 200;
    const late = await live.join(session.pin, 'Tarde');
    clock += 800;
    const r = await push(live, ana.token, { seq: 1, ago: [100] }, never);
    expect(r.animal).toBe((await live.getPlayer(session.id, ana.player.id))!.data!.animal);
    clock += ROUND_MAX_MS.short;
    await tick(session.id);
    await finishedThenNext(session.id);
    await live.advance(session.id); // round 2 countdown
    expect((await live.getPlayer(session.id, late.player.id))!.data?.animal).toBeDefined();
  });

  it('a runner close to the line is not finished until its own push says so', async () => {
    const session = await newRace();
    const ana = await live.join(session.pin, 'Ana');
    await toRace(session.id);
    // Push in short batches until coasting alone would carry her over the line.
    let seq = 0;
    const coast = (speed: number) => (speed / PHYSICS.drag) * (1 - Math.exp(-PHYSICS.drag * 0.9));
    for (;;) {
      clock += 300;
      const r = await push(live, ana.token, { seq: ++seq, ago: [250, 100] }, never);
      expect(r.finished).toBe(false);
      if (r.meters + coast(r.speed) > TRACK_METERS.short) break;
    }
    // Coasting would carry her over the line, but no push has confirmed it yet.
    clock += 900;
    await tick(session.id);
    expect((await state(session.id)).state.phase).toBe('racing');
    const standings = publisher.last('embolsau.standings')!.runners as { finished: boolean; meters: number }[];
    expect(standings[0]!.finished).toBe(false);
    expect(standings[0]!.meters).toBeLessThan(TRACK_METERS.short);
    // Her next pushes confirm it, and then the round closes.
    for (let i = 0; i < 3; i++) {
      clock += 1_000;
      await push(live, ana.token, { seq: ++seq, ago: [900, 700, 500, 300, 100] }, never);
    }
    await tick(session.id);
    await finishedThenNext(session.id);
    expect(await ended(session.id)).toBe(true);
  });

  it('concurrent ticks close the round once', async () => {
    const session = await newRace();
    const ana = await live.join(session.pin, 'Ana');
    await toRace(session.id);
    await runSeconds(session.id, 2, [{ p: ana, rate: 6 }], new Map());
    clock += ROUND_MAX_MS.short;
    await Promise.allSettled([tick(session.id), tick(session.id), live.advance(session.id)]);
    expect((await state(session.id)).state.phase).toBe('finished');
    await Promise.allSettled([live.advance(session.id), live.advance(session.id)]);
    expect(publisher.events.filter((e) => e.event.type === 'ended')).toHaveLength(1);
    expect(publisher.events.filter((e) => e.event.type === 'embolsau.roundResults')).toHaveLength(0);
    const player = (await live.getPlayer(session.id, ana.player.id))!;
    // Alone and not finished: 300 × meters / track, added once.
    expect(player.score).toBe(pointsFor({ timeMs: null, meters: player.data!.meters as number }, { winnerMs: null, closedAtMs: ROUND_MAX_MS.short, trackMeters: TRACK_METERS.short }));
  });

  it('the race waits on the big screen until the presenter asks for the results', async () => {
    const session = await newRace({ rounds: 2 });
    const ana = await live.join(session.pin, 'Ana');
    await toRace(session.id);
    await runSeconds(session.id, 3, [{ p: ana, rate: 5 }], new Map([[ana.player.id, 0]]));
    clock += ROUND_MAX_MS.short;
    await tick(session.id);
    expect((await state(session.id)).state.phase).toBe('finished');
    const metersAtEnd = (publisher.last('embolsau.standings')!.runners as { meters: number }[])[0]!.meters;
    // Time goes by: ticks change nothing, taps no longer count.
    clock += 60_000;
    expect((await tick(session.id)).phase).toBe('finished');
    await expect(push(live, ana.token, { seq: 99, ago: [100] }, never)).rejects.toThrow('not_racing');
    await live.advance(session.id);
    expect((await state(session.id)).state.phase).toBe('roundResults');
    const r1 = publisher.last('embolsau.roundResults')!.top as { meters: number }[];
    expect(r1[0]!.meters).toBeCloseTo(metersAtEnd);
  });

  it('pointsFor: 1000 to the winner, by time gap for finishers, by meters for the rest', () => {
    const round = { winnerMs: 20_000, closedAtMs: 34_000, trackMeters: 160 };
    expect(pointsFor({ timeMs: 20_000, meters: 160 }, round)).toBe(1000);
    expect(pointsFor({ timeMs: 27_000, meters: 160 }, round)).toBe(650);
    expect(pointsFor({ timeMs: 34_000, meters: 160 }, round)).toBe(300);
    expect(pointsFor({ timeMs: null, meters: 80 }, round)).toBe(150);
    expect(pointsFor({ timeMs: null, meters: 159.9 }, round)).toBeLessThan(300);
    expect(pointsFor({ timeMs: null, meters: 40 }, { winnerMs: null, closedAtMs: 40_000, trackMeters: 160 })).toBe(75);
  });

  it('snapshot lets a phone resume mid-race', async () => {
    const session = await newRace();
    const ana = await live.join(session.pin, 'Ana');
    await live.advance(session.id);
    await pick(live, ana.token, 'tatu');
    clock += PICK_MS;
    await tick(session.id);
    clock += COUNTDOWN_MS;
    await tick(session.id);
    await runSeconds(session.id, 2, [{ p: ana, rate: 6 }], new Map());
    const snap = (await live.snapshot(session.id, ana.player.id)).module as Record<string, unknown>;
    expect(snap).toMatchObject({ phase: 'racing', animal: 'tatu', meter: true, inRound: true });
    expect((snap.runner as { meters: number }).meters).toBeGreaterThan(0);
    const host = (await live.snapshot(session.id)).module as Record<string, unknown>;
    expect(host).toMatchObject({ phase: 'racing', round: 1, rounds: 1 });
  });

  it('caps the session at the configured players', async () => {
    const session = await newRace({ maxPlayers: 1 });
    await live.join(session.pin, 'Ana');
    await expect(live.join(session.pin, 'Beto')).rejects.toThrow(new LiveError('session_full'));
  });

  it('accepts taps once the countdown is over, before the tick flips it', async () => {
    const session = await newRace();
    const ana = await live.join(session.pin, 'Ana');
    await live.advance(session.id);
    clock += PICK_MS;
    await tick(session.id);
    clock += COUNTDOWN_MS + 400;
    expect((await push(live, ana.token, { seq: 1, ago: [300, 200, 100] }, never)).meters).toBeGreaterThan(0);
  });
});
