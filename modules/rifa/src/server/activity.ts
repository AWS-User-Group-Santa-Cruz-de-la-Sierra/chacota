import { channels, LiveError, type ActivityServer, type LiveService, type Session } from '@chacota/live';
import { applyRound, bagEntries, drawRound, isPlaying, resetBag, setStatus, type RandomInt } from '../bag';
import { rifaManifest } from '../manifest';
import {
  DEFAULT_TITLE,
  type BagEntry,
  type Entry,
  type EntryStatus,
  type FinalSnapshot,
  type HostSnapshot,
  type OnOverboard,
  type PlayerSnapshot,
  type RifaConfig,
  type RifaEvent,
  type RifaState,
} from '../model';
import { randomInt as cryptoRandomInt } from 'node:crypto';
import { parseConfig } from './config';

type S = Session<RifaState>;

/** The people in the bag: the typed names, or the players who are in right now. */
async function allEntries(live: LiveService, s: S): Promise<Entry[]> {
  if (s.state.mode === 'list') return s.state.entries ?? [];
  return (await live.listPlayers(s.id)).map((p) => ({ id: p.id, name: p.nickname }));
}

const bagOf = async (live: LiveService, s: S): Promise<BagEntry[]> => bagEntries(await allEntries(live, s), s.state);

async function fresh(live: LiveService, id: string): Promise<S> {
  const s = await live.getSession<RifaState>(id);
  if (!s) throw new LiveError('session_not_found');
  if (s.status === 'ended') throw new LiveError('session_ended');
  return s;
}

const publish = (live: LiveService, id: string, event: RifaEvent) => live.publish(id, event);

const winsOf = (state: RifaState, playerId: string): number[] =>
  state.winners.flatMap((w) => (w.kind === 'win' && w.entryId === playerId ? [w.round] : []));

export function createRifaActivity(opts: { randomInt?: RandomInt } = {}): ActivityServer<RifaConfig, RifaState> {
  const randomInt: RandomInt = opts.randomInt ?? ((max) => cryptoRandomInt(max));

  return {
    manifest: rifaManifest,

    prepare(content) {
      const config = parseConfig(content);
      const state: RifaState = {
        mode: config.mode,
        overboard: config.overboard,
        onOverboard: 'return',
        opened: config.mode === 'list',
        discarded: [],
        won: [],
        winners: [],
        rounds: 0,
        round: null,
        ...(config.mode === 'list' ? { entries: (config.names ?? []).map((name, i) => ({ id: `L${i}`, name })) } : {}),
      };
      return { title: config.title?.trim() || DEFAULT_TITLE, state, ...(config.mode === 'list' ? { phones: false as const } : {}) };
    },

    async advance(live, s) {
      if (!s.state.opened) return live.transition(s, { state: { ...s.state, opened: true } });
      // Nothing to do is not an error: the presenter's action only catches invalid_transition.
      if (isPlaying(s.state, live.now())) return s;
      const pool = (await bagOf(live, s)).filter((e) => e.status === 'bag').map(({ id, name }) => ({ id, name }));
      const round = drawRound(pool, s.state, live.now(), randomInt);
      if (!round) return s;
      const updated = await live.transition(s, { state: applyRound(s.state, round) });
      await publish(live, s.id, { type: 'rifa.round', round });
      if (s.state.mode === 'qr') await live.addScore(s.id, round.winner.entryId, 1);
      return updated;
    },

    async snapshot(live, s, playerId) {
      const { mode, overboard, onOverboard, opened, rounds, round, winners } = s.state;
      if (playerId === undefined) {
        const host: HostSnapshot = { mode, overboard, onOverboard, opened, rounds, round, winners, entries: await bagOf(live, s) };
        return { ...host };
      }
      const status: EntryStatus = s.state.won.includes(playerId) ? 'won' : s.state.discarded.includes(playerId) ? 'out' : 'bag';
      const player: PlayerSnapshot = { status, round, wins: winsOf(s.state, playerId) };
      return { ...player };
    },

    async finalSnapshot(_live, s, playerId) {
      const final: FinalSnapshot = playerId === undefined ? { winners: s.state.winners } : { winners: s.state.winners, wins: winsOf(s.state, playerId) };
      return { ...final };
    },

    async results(_live, s, players) {
      return {
        columns: [{ key: 'won', label: { es: 'Ganó en', en: 'Won in' }, format: 'text' }],
        extra: Object.fromEntries(
          players.map((p) => {
            const wins = winsOf(s.state, p.id);
            return [p.id, { won: wins.length > 0 ? wins.join(', ') : null }];
          }),
        ),
        details: { winners: s.state.winners },
      };
    },

    hostActions: {
      async setOnOverboard(live, session, args) {
        const { value } = args as { value: OnOverboard };
        if (value !== 'discard' && value !== 'return') throw new LiveError('invalid_transition');
        const s = await fresh(live, session.id);
        const updated = await live.transition(s, { state: { ...s.state, onOverboard: value } });
        return { version: updated.version, onOverboard: value };
      },

      async discard(live, session, args) {
        return setEntry(live, session.id, (args as { entryId: string }).entryId, 'out');
      },

      async restore(live, session, args) {
        return setEntry(live, session.id, (args as { entryId: string }).entryId, 'bag');
      },

      async reset(live, session) {
        const s = await fresh(live, session.id);
        if (isPlaying(s.state, live.now())) return { version: s.version };
        const updated = await live.transition(s, { state: resetBag(s.state) });
        await publish(live, s.id, { type: 'rifa.bag', reset: true });
        return { version: updated.version };
      },

      async bag(live, session) {
        const s = await fresh(live, session.id);
        return { version: s.version, entries: await bagOf(live, s) };
      },
    },
  };
}

async function setEntry(live: LiveService, id: string, entryId: string, to: 'bag' | 'out'): Promise<{ version: number }> {
  const s = await fresh(live, id);
  const entry = (await bagOf(live, s)).find((e) => e.id === entryId);
  // Unknown ids and winners stay as they are; so does an entry already where it should be.
  if (!entry || entry.status === 'won' || entry.status === (to === 'out' ? 'out' : 'bag')) return { version: s.version };
  const updated = await live.transition(s, { state: setStatus(s.state, entryId, to) });
  await publish(live, id, { type: 'rifa.bag', changes: { [entryId]: to } });
  return { version: updated.version };
}

export const rifaActivity = createRifaActivity();
