import { useTestDb } from '@chacota/db/testing';
import { channels, LiveError, LiveService, MemoryPublisher } from '@chacota/live';
import { beforeEach, describe, expect, it } from 'vitest';
import { LEAD_MS, type BagEntry, type RifaState, type Round } from '../src/model';
import { createRifaActivity } from '../src/server';

const db = useTestDb();
let clock = 1_000_000;
let publisher: MemoryPublisher;
let live: LiveService;
const rifa = createRifaActivity({ randomInt: () => 0 });
beforeEach(() => {
  clock = 1_000_000;
  publisher = new MemoryPublisher();
  live = new LiveService(db(), publisher, [rifa], { tokenSecret: 'test-secret', now: () => clock });
});

const listRifa = (names = ['Ana', 'Beto', 'Cata', 'Dani'], overboard = 2) =>
  live.createSession({ orgId: 'o', orgName: 'UG', hostUserId: 'h', module: 'rifa', content: { mode: 'list', overboard, names } });
const qrRifa = (overboard = 1) =>
  live.createSession({ orgId: 'o', orgName: 'UG', hostUserId: 'h', module: 'rifa', content: { mode: 'qr', overboard } });
const session_ = async (id: string) => (await live.getSession<RifaState>(id))!;
const state = async (id: string) => (await session_(id)).state;
const version = async (id: string) => (await session_(id)).version;
const action = <T>(id: string, name: string, args?: unknown) => live.hostAction(id, name, args) as Promise<T>;
const events = (id: string) => publisher.events.filter((p) => p.channel === channels.public(id)).map((p) => p.event as { type: string; [k: string]: unknown });
const rounds = (id: string) => events(id).filter((e) => e.type === 'rifa.round').map((e) => e.round as Round);
const bag = async (id: string) => (await action<{ entries: BagEntry[] }>(id, 'bag')).entries;
const inBag = async (id: string) => (await bag(id)).filter((e) => e.status === 'bag').map((e) => e.id);

describe('Rifa activity', () => {
  it('list mode: no lobby, draws until the bag runs out', async () => {
    const session = await listRifa(['Ana', 'Beto', 'Cata', 'Dani'], 2);
    expect(session.status).toBe('running');
    expect(session.phones).toBe(false);
    await expect(live.join(session.pin, 'Eva')).rejects.toThrow(LiveError);

    await live.advance(session.id);
    const [r1] = rounds(session.id);
    expect(r1!.out).toHaveLength(2);
    expect(r1!.out[0]!.startsAt).toBe(clock + LEAD_MS);
    expect(r1!.winner.entryId).toBeDefined();

    clock = r1!.endsAt;
    await live.advance(session.id);
    // 'return': the two sent to the water went back, the winner did not: bag of 3, k = 2
    expect(rounds(session.id)).toHaveLength(2);
    expect((await state(session.id)).won).toHaveLength(2);

    clock = rounds(session.id)[1]!.endsAt;
    await live.advance(session.id);
    clock = rounds(session.id)[2]!.endsAt;
    await live.advance(session.id);
    expect(rounds(session.id)).toHaveLength(4);
    expect(await inBag(session.id)).toEqual([]);

    clock = rounds(session.id)[3]!.endsAt;
    const before = (await version(session.id));
    await live.advance(session.id);
    expect((await version(session.id))).toBe(before);
    const s = await state(session.id);
    expect(s.winners.filter((w) => w.kind === 'win')).toHaveLength(4);
  });

  it('discard mode shrinks the bag by k + 1 per round', async () => {
    const session = await listRifa(['A', 'B', 'C', 'D', 'E', 'F'], 2);
    await action(session.id, 'setOnOverboard', { value: 'discard' });
    await live.advance(session.id);
    expect(await inBag(session.id)).toHaveLength(3);
  });

  it('no draw while a round plays', async () => {
    const session = await listRifa();
    await live.advance(session.id);
    const v = (await version(session.id));
    const again = await live.advance(session.id);
    expect(rounds(session.id)).toHaveLength(1);
    expect(again.version).toBe(v);
    expect((await version(session.id))).toBe(v);
  });

  it('empty bag does nothing until someone is restored', async () => {
    const session = await listRifa(['Ana', 'Beto']);
    for (const id of ['L0', 'L1']) await action(session.id, 'discard', { entryId: id });
    const v = (await version(session.id));
    await live.advance(session.id);
    expect((await version(session.id))).toBe(v);
    expect(rounds(session.id)).toHaveLength(0);

    await action(session.id, 'restore', { entryId: 'L1' });
    await live.advance(session.id);
    const [r] = rounds(session.id);
    expect(r!.winner.entryId).toBe('L1');
    expect(r!.out).toEqual([]);
  });

  it('qr mode: first advance opens, then draws among players; late joiner enters the next round', async () => {
    const session = await qrRifa(1);
    expect(session.status).toBe('lobby');
    await live.join(session.pin, 'Ana');
    await live.join(session.pin, 'Beto');
    await live.join(session.pin, 'Cata');

    const opened = await live.advance(session.id);
    expect(opened.status).toBe('running');
    expect((opened.state as RifaState).opened).toBe(true);
    expect(rounds(session.id)).toHaveLength(0);

    await live.advance(session.id);
    expect(rounds(session.id)).toHaveLength(1);
    const eva = await live.join(session.pin, 'Eva');
    clock = rounds(session.id)[0]!.endsAt;
    expect((await bag(session.id)).map((e) => e.id)).toContain(eva.player.id);
    expect((await bag(session.id)).find((e) => e.id === eva.player.id)!.name).toBe('Eva');
  });

  it('concurrent advances draw once', async () => {
    const session = await listRifa();
    const v = (await version(session.id));
    const results = await Promise.allSettled([live.advance(session.id, v), live.advance(session.id, v)]);
    expect(rounds(session.id)).toHaveLength(1);
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(failed).toHaveLength(1);
    expect(failed[0]!.reason.code).toBe('invalid_transition');
  });

  it('discard, restore and reset tell the phones', async () => {
    const session = await listRifa();
    await action(session.id, 'discard', { entryId: 'L2' });
    await action(session.id, 'restore', { entryId: 'L2' });
    await action(session.id, 'discard', { entryId: 'nope' });
    const bagEvents = () => events(session.id).filter((e) => e.type === 'rifa.bag');
    expect(bagEvents().slice(0, 2)).toEqual([
      { type: 'rifa.bag', changes: { L2: 'out' } },
      { type: 'rifa.bag', changes: { L2: 'bag' } },
    ]);
    expect(bagEvents()).toHaveLength(2);

    await live.advance(session.id);
    const winner = rounds(session.id)[0]!.winner.entryId;
    await action(session.id, 'discard', { entryId: winner });
    expect(bagEvents()).toHaveLength(2);

    const v = (await version(session.id));
    await action(session.id, 'reset');
    expect((await version(session.id))).toBe(v);
    clock = rounds(session.id)[0]!.endsAt;
    await action(session.id, 'reset');
    expect(bagEvents().at(-1)).toEqual({ type: 'rifa.bag', reset: true });
    expect(await inBag(session.id)).toHaveLength(4);
  });

  it('the winner gets a point and the history says when', async () => {
    const session = await qrRifa(0);
    const ana = await live.join(session.pin, 'Ana');
    await live.join(session.pin, 'Beto');
    await live.advance(session.id);
    await live.advance(session.id);
    const winner = rounds(session.id)[0]!.winner.entryId;
    const players = await live.listPlayers(session.id);
    expect(players.find((p) => p.id === winner)!.score).toBe(1);
    expect(ana.player.id).toBeDefined();

    await live.end(session.id);
    const results = (await live.getResults((await live.getSession(session.id))!))!;
    expect(results.columns.at(-1)!.key).toBe('won');
    const entry = results.standings.find((e) => e.nickname === (rounds(session.id)[0]!.winner.name));
    expect(entry?.extra.won).toBe('1');
    expect(results.standings.find((e) => e.nickname !== entry?.nickname)?.extra.won).toBeNull();
    expect(results.details).toEqual({ winners: (await state(session.id)).winners });
  });

  it('snapshot resumes mid-round and finalSnapshot keeps the winners', async () => {
    const session = await qrRifa(0);
    const ana = await live.join(session.pin, 'Ana');
    await live.advance(session.id);
    await live.advance(session.id);
    const round = rounds(session.id)[0]!;

    const host = (await live.snapshot(session.id)).module as { round: Round; entries: BagEntry[]; mode: string };
    expect(host.round).toEqual(round);
    expect(host.mode).toBe('qr');
    const phone = (await live.snapshot(session.id, ana.player.id)).module as { status: string; wins: number[]; round: Round };
    expect(phone.status).toBe('won');
    expect(phone.wins).toEqual([1]);

    await live.end(session.id);
    const final = (await live.snapshot(session.id)).module as { winners: unknown[] };
    expect(final.winners).toEqual([{ kind: 'win', round: 1, entryId: ana.player.id, name: 'Ana' }]);
    const finalPhone = (await live.snapshot(session.id, ana.player.id)).module as { wins: number[] };
    expect(finalPhone.wins).toEqual([1]);
  });
});
