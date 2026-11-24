import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { strip } from '@chacota/db';
import { channels, LiveError, sessionKeys, shardOf, type ActivityServer, type LiveService, type Player, type Session } from '@chacota/live';
import { embolsauManifest } from '../manifest';
import {
  ANIMALS,
  CLOSING_MS,
  COUNTDOWN_MS,
  PICK_MS,
  PODIUM_FINISHERS,
  TRACK_METERS,
  type Animal,
  type EmbolsauConfig,
  type EmbolsauState,
  type Phase,
} from '../model';
import { parseConfig } from './config';
import { placesKey, roundSk, roundsPk, runnerSk, runnersPk } from './keys';
import { embolsauRoutes } from './routes';
import { isRaceOn, listRunners, roundCutoff, toResult, type StoredRunner } from './runners';
import { project, rankRound, sortRunners, type RoundPlace } from './standings';

type S = Session<EmbolsauState>;

export interface RoundRecord {
  round: number;
  top: RoundPlace[];
  ranks: Record<string, { place: number; points: number; total: number }>;
}

const TOP = 10;

async function publishPhase(live: LiveService, s: S): Promise<S> {
  const { phase, round, phaseEndsAt, raceStartedAt, config } = s.state;
  await live.publish(s.id, { type: 'embolsau.phase', phase, round, rounds: config.rounds, phaseEndsAt, raceStartedAt, meter: config.meter, track: config.track });
  return s;
}

async function moveTo(live: LiveService, s: S, phase: Phase, patch: Partial<EmbolsauState> = {}): Promise<S> {
  const updated = await live.transition(s, { state: { ...s.state, phase, ...patch } });
  return publishPhase(live, updated);
}

/** Whoever didn't pick gets a random animal: choosing is only visual. */
async function assignMissingAnimals(live: LiveService, s: S): Promise<void> {
  const players = await live.listPlayers(s.id);
  await Promise.all(
    players
      .filter((p) => !ANIMALS.includes(p.data?.animal as Animal))
      .map((p) =>
        live.db.doc.send(
          new UpdateCommand({
            TableName: live.db.tableName,
            Key: sessionKeys.player(s.id, p.id),
            UpdateExpression: 'SET #data = :data',
            ExpressionAttributeNames: { '#data': 'data' },
            ExpressionAttributeValues: { ':data': { ...p.data, animal: ANIMALS[Math.floor(Math.random() * ANIMALS.length)] } },
          }),
        ),
      ),
  );
}

async function startCountdown(live: LiveService, s: S, round: number): Promise<S> {
  await assignMissingAnimals(live, s);
  const raceStartedAt = live.now() + COUNTDOWN_MS;
  return moveTo(live, s, 'countdown', { round, phaseEndsAt: raceStartedAt, raceStartedAt });
}

const eligibleOf = (players: Player[], s: S) => players.filter((p) => p.joinedAt <= s.state.raceStartedAt!);

async function closeRound(live: LiveService, s: S): Promise<S> {
  const closedAt = Math.min(live.now(), roundCutoff(s.state));
  // The transition is the lock: only one caller (tick or button) gets past it and adds the points.
  const updated = await live.transition(s, { state: { ...s.state, phase: 'roundResults', phaseEndsAt: null } });
  const [runners, players] = await Promise.all([listRunners(live, s.id, s.state.round), live.listPlayers(s.id)]);
  const trackMeters = TRACK_METERS[s.state.config.track];
  const places = rankRound(runners, eligibleOf(players, s), { raceStartedAt: s.state.raceStartedAt!, closedAt, trackMeters });
  const byId = new Map(players.map((p) => [p.id, p]));
  const fallsOf = new Map(runners.map((r) => [r.playerId, r.falls]));

  const ranks: RoundRecord['ranks'] = {};
  await Promise.all(
    places.map(async (place) => {
      const player = byId.get(place.playerId)!;
      const data = player.data ?? {};
      const best = data.bestTimeMs as number | undefined;
      const { Attributes } = await live.db.doc.send(
        new UpdateCommand({
          TableName: live.db.tableName,
          Key: sessionKeys.player(s.id, place.playerId),
          UpdateExpression: 'ADD score :points SET #data = :data',
          ExpressionAttributeNames: { '#data': 'data' },
          ExpressionAttributeValues: {
            ':points': place.points,
            ':data': {
              ...data,
              falls: Number(data.falls ?? 0) + (fallsOf.get(place.playerId) ?? 0),
              meters: Number(data.meters ?? 0) + place.meters,
              ...(place.timeMs !== null && (best === undefined || place.timeMs < best) ? { bestTimeMs: place.timeMs } : {}),
            },
          },
          ReturnValues: 'UPDATED_NEW',
        }),
      );
      ranks[place.playerId] = { place: place.place, points: place.points, total: Number(Attributes?.score ?? place.points) };
    }),
  );

  const record: RoundRecord = { round: s.state.round, top: places.slice(0, TOP), ranks };
  await live.db.doc.send(
    new PutCommand({ TableName: live.db.tableName, Item: { pk: roundsPk(s.id), sk: roundSk(s.state.round), ...record, ttl: live.ttl() } }),
  );
  await live.publish(s.id, { type: 'embolsau.roundResults', rounds: s.state.config.rounds, ...record });
  return publishPhase(live, updated);
}

async function publishPicks(live: LiveService, s: S): Promise<void> {
  const players = await live.listPlayers(s.id);
  const counts = Object.fromEntries(ANIMALS.map((a) => [a, 0])) as Record<Animal, number>;
  for (const p of players) if (ANIMALS.includes(p.data?.animal as Animal)) counts[p.data!.animal as Animal]++;
  await live.publish(s.id, { type: 'embolsau.picks', counts, picked: Object.values(counts).reduce((a, b) => a + b, 0) }, channels.host(s.id));
}

/** Ranks the runners now, tells the presenter's screen, and stores each place for the phones. */
async function race(live: LiveService, s: S): Promise<S> {
  const now = live.now();
  const cutoff = roundCutoff(s.state);
  if (now >= cutoff) return closeRound(live, s);

  const trackMeters = TRACK_METERS[s.state.config.track];
  const runners = sortRunners((await listRunners(live, s.id, s.state.round)).map((r) => project(r, now, trackMeters)));
  const places = Object.fromEntries(runners.map((r, i) => [r.playerId, i + 1]));
  await Promise.all([
    live.db.doc.send(new PutCommand({ TableName: live.db.tableName, Item: { ...placesKey(s.id, s.state.round), places, ttl: live.ttl() } })),
    live.publish(
      s.id,
      {
        type: 'embolsau.standings',
        round: s.state.round,
        at: now,
        runners: runners.map((r, i) => ({
          id: r.playerId,
          nickname: r.nickname,
          animal: r.animal,
          bag: r.bag,
          meters: r.meters,
          speed: r.speed,
          down: now < r.downUntil,
          place: i + 1,
          finished: r.finishedAt !== null,
        })),
      },
      channels.host(s.id),
    ),
  ]);

  const finished = runners.filter((r) => r.finishedAt !== null).length;
  if (finished === 0) return s;
  const eligible = eligibleOf(await live.listPlayers(s.id), s).length;
  // Everybody is in: no need to wait for the rest of the closing.
  if (finished >= eligible) return closeRound(live, s);
  if (s.state.phase === 'racing' && finished >= PODIUM_FINISHERS) return moveTo(live, s, 'closing', { phaseEndsAt: now + CLOSING_MS });
  return s;
}

/** Called by the presenter's screen about twice a second: moves the phases on with the server clock. */
async function tick(live: LiveService, session: S): Promise<{ phase: Phase | null; version: number }> {
  let s = session;
  try {
    if (s.status !== 'running') return { phase: s.state.phase, version: s.version };
    const now = live.now();
    const { phase, phaseEndsAt } = s.state;
    if (phase === 'picking') {
      if (phaseEndsAt !== null && now >= phaseEndsAt) s = await startCountdown(live, s, 1);
      else await publishPicks(live, s);
    } else if (phase === 'countdown') {
      if (isRaceOn(s, now)) s = await race(live, await moveTo(live, s, 'racing', { phaseEndsAt: null }));
    } else if (phase === 'racing') {
      s = await race(live, s);
    } else if (phase === 'closing') {
      s = phaseEndsAt !== null && now >= phaseEndsAt ? await closeRound(live, s) : await race(live, s);
    }
  } catch (error) {
    // Another tick or the presenter's button moved the session first: nothing to do.
    if (!(error instanceof LiveError && error.code === 'invalid_transition')) throw error;
    s = (await live.getSession<EmbolsauState>(s.id)) ?? s;
  }
  return { phase: s.state.phase, version: s.version };
}

async function listRounds(live: LiveService, sessionId: string): Promise<RoundRecord[]> {
  const { Items } = await live.db.doc.send(
    new QueryCommand({ TableName: live.db.tableName, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': roundsPk(sessionId) }, ConsistentRead: true }),
  );
  return (Items ?? []).map((i) => strip<RoundRecord>(i));
}

export const embolsauActivity: ActivityServer<EmbolsauConfig, EmbolsauState> = {
  manifest: embolsauManifest,

  prepare(content) {
    const config = parseConfig(content);
    return {
      title: 'Embolsau',
      state: { config, phase: null, round: 0, phaseEndsAt: null, raceStartedAt: null },
      maxPlayers: config.maxPlayers,
    };
  },

  async advance(live, session) {
    const s = session;
    switch (s.state.phase) {
      case null:
        return moveTo(live, s, 'picking', { phaseEndsAt: live.now() + PICK_MS });
      case 'picking':
        return startCountdown(live, s, 1);
      case 'countdown':
        return s;
      case 'racing':
      case 'closing':
        return closeRound(live, s);
      case 'roundResults':
        return s.state.round < s.state.config.rounds ? startCountdown(live, s, s.state.round + 1) : live.end<EmbolsauState>(s.id);
    }
  },

  async snapshot(live, session, playerId) {
    const { config, phase, round, phaseEndsAt, raceStartedAt } = session.state;
    const common = { phase, round, rounds: config.rounds, phaseEndsAt, raceStartedAt, track: config.track, meter: config.meter };
    const lastRound = phase === 'roundResults' ? (await listRounds(live, session.id)).find((r) => r.round === round) : undefined;
    if (playerId === undefined) return { ...common, config, ...(lastRound ? { lastRound } : {}) };

    const player = await live.getPlayer(session.id, playerId);
    const inRound = raceStartedAt !== null && player !== undefined && player.joinedAt <= raceStartedAt;
    let runner = null;
    if (inRound && round > 0) {
      const { Item } = await live.db.doc.send(
        new GetCommand({ TableName: live.db.tableName, Key: { pk: runnersPk(session.id, round, shardOf(playerId)), sk: runnerSk(playerId) }, ConsistentRead: true }),
      );
      const { Item: placesItem } = await live.db.doc.send(new GetCommand({ TableName: live.db.tableName, Key: placesKey(session.id, round) }));
      if (Item) {
        const now = live.now();
        const stored = project(strip<StoredRunner>(Item), Math.min(now, roundCutoff(session.state)), TRACK_METERS[config.track]);
        runner = toResult(stored, now, (placesItem?.places as Record<string, number> | undefined)?.[playerId] ?? null);
      }
    }
    return {
      ...common,
      animal: (player?.data?.animal as Animal | undefined) ?? null,
      inRound,
      runner,
      ...(lastRound?.ranks[playerId] ? { lastRank: lastRound.ranks[playerId] } : {}),
    };
  },

  async results(live, session, players) {
    const rounds = await listRounds(live, session.id);
    return {
      columns: [
        { key: 'bestTime', label: { es: 'Mejor tiempo (s)', en: 'Best time (s)' }, format: 'seconds' },
        { key: 'meters', label: { es: 'Metros', en: 'Meters' }, format: 'int' },
        { key: 'falls', label: { es: 'Caídas', en: 'Falls' }, format: 'int' },
        { key: 'animal', label: { es: 'Animalito', en: 'Critter' }, format: 'text' },
      ],
      extra: Object.fromEntries(
        players.map((p) => [
          p.id,
          {
            bestTime: (p.data?.bestTimeMs as number | undefined) ?? null,
            meters: Math.round(Number(p.data?.meters ?? 0)),
            falls: Number(p.data?.falls ?? 0),
            animal: (p.data?.animal as string | undefined) ?? null,
          },
        ]),
      ),
      details: { config: session.state.config, rounds: rounds.map((r) => ({ round: r.round, top: r.top })) },
    };
  },

  hostActions: {
    tick: (live, session) => tick(live, session as S),
  },

  routes: embolsauRoutes,
};
