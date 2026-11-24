import { randomInt } from 'node:crypto';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { isConditionalCheckFailure, strip } from '@chacota/db';
import { LiveError, sessionKeys, shardOf, type LiveService, type Session } from '@chacota/live';
import { ANIMALS, bagOf, ROUND_MAX_MS, TRACK_METERS, type Animal, type EmbolsauState, type RunnerResult } from '../model';
import { limitTaps, PHYSICS, simulate, startRunner, type Runner } from '../physics';
import { placesKey, runnerSk, runnersPk } from './keys';

export type EmbolsauErrorCode = 'not_picking' | 'not_racing' | 'not_in_round' | 'invalid_input';

export class EmbolsauError extends Error {
  constructor(readonly code: EmbolsauErrorCode) {
    super(code);
    this.name = 'EmbolsauError';
  }
}

export interface StoredRunner extends Runner {
  playerId: string;
  nickname: string;
  animal: Animal;
  bag: number;
  seq: number;
}

export type PushResult = RunnerResult;

/** Secure randomness for falls: the phone can't predict them. */
export const secureRng = () => randomInt(0, 2 ** 32) / 2 ** 32;

const isAnimal = (value: unknown): value is Animal => ANIMALS.includes(value as Animal);

async function load(live: LiveService, token: string) {
  const { sessionId, playerId } = live.verifyToken(token);
  const [session, player] = await Promise.all([live.getSession<EmbolsauState>(sessionId), live.getPlayer(sessionId, playerId)]);
  if (!session || !player) throw new LiveError('session_not_found');
  return { session, player };
}

export async function pick(live: LiveService, token: string, animal: Animal): Promise<{ animal: Animal }> {
  if (!isAnimal(animal)) throw new EmbolsauError('invalid_input');
  const { session, player } = await load(live, token);
  if (session.status !== 'running' || session.state.phase !== 'picking') throw new EmbolsauError('not_picking');
  await live.db.doc.send(
    new UpdateCommand({
      TableName: live.db.tableName,
      Key: sessionKeys.player(session.id, player.id),
      UpdateExpression: 'SET #data = :data',
      ExpressionAttributeNames: { '#data': 'data' },
      ExpressionAttributeValues: { ':data': { ...player.data, animal } },
    }),
  );
  return { animal };
}

/** The race is on from the start time, even if the presenter's tick hasn't flipped the countdown yet. */
export function isRaceOn(session: Session<EmbolsauState>, now: number): boolean {
  const { phase, raceStartedAt } = session.state;
  if (session.status !== 'running' || raceStartedAt === null) return false;
  return phase === 'racing' || phase === 'closing' || (phase === 'countdown' && now >= raceStartedAt);
}

/** When the round stops accepting taps: when it finished, the end of the closing window, or the round's time limit. */
export function roundCutoff(state: EmbolsauState): number {
  const limit = state.raceStartedAt! + ROUND_MAX_MS[state.config.track];
  if (state.closedAt != null) return Math.min(state.closedAt, limit);
  return state.phase === 'closing' && state.phaseEndsAt !== null ? Math.min(state.phaseEndsAt, limit) : limit;
}

export function toResult(runner: StoredRunner, now: number, place: number | null): PushResult {
  return {
    animal: runner.animal,
    meters: runner.meters,
    speed: runner.speed,
    down: now < runner.downUntil,
    downUntil: runner.downUntil,
    finished: runner.finishedAt !== null,
    place,
    falls: runner.falls,
  };
}

async function getRunner(live: LiveService, session: Session<EmbolsauState>, playerId: string): Promise<StoredRunner | undefined> {
  const { Item } = await live.db.doc.send(
    new GetCommand({
      TableName: live.db.tableName,
      Key: { pk: runnersPk(session.id, session.state.round, shardOf(playerId)), sk: runnerSk(playerId) },
      ConsistentRead: true,
    }),
  );
  return Item ? strip<StoredRunner>(Item) : undefined;
}

async function getPlace(live: LiveService, session: Session<EmbolsauState>, playerId: string): Promise<number | null> {
  const { Item } = await live.db.doc.send(new GetCommand({ TableName: live.db.tableName, Key: placesKey(session.id, session.state.round) }));
  return (Item?.places as Record<string, number> | undefined)?.[playerId] ?? null;
}

/**
 * A batch of taps from a phone. `ago` holds, for each tap, how many milliseconds before sending it
 * happened; the server places them on its own clock, so the phone's clock never matters.
 */
export async function push(
  live: LiveService,
  token: string,
  input: { seq: number; ago: number[] },
  rng: () => number = secureRng,
): Promise<PushResult> {
  const now = live.now();
  const { session, player } = await load(live, token);
  const state = session.state;
  if (!isRaceOn(session, now)) throw new EmbolsauError('not_racing');
  if (player.joinedAt > state.raceStartedAt!) throw new EmbolsauError('not_in_round');

  const [existing, place] = await Promise.all([getRunner(live, session, player.id), getPlace(live, session, player.id)]);
  if (existing && input.seq <= existing.seq) return toResult(existing, now, place);

  const base: StoredRunner = existing ?? {
    ...startRunner(state.raceStartedAt!),
    playerId: player.id,
    nickname: player.nickname,
    animal: isAnimal(player.data?.animal) ? player.data.animal : ANIMALS[0],
    bag: bagOf(player.id),
    seq: 0,
  };
  const until = Math.min(now, roundCutoff(state));
  const taps = limitTaps(
    input.ago
      .map((ago) => now - ago)
      .filter((t) => t >= state.raceStartedAt! && t <= until)
      .map((t) => Math.max(t, base.t)),
    PHYSICS.maxTapsPerSec,
  );
  const runner: StoredRunner = { ...base, ...simulate(base, taps, until, TRACK_METERS[state.config.track], rng), seq: input.seq };

  try {
    await live.db.doc.send(
      new PutCommand({
        TableName: live.db.tableName,
        Item: { pk: runnersPk(session.id, state.round, shardOf(player.id)), sk: runnerSk(player.id), ...runner, ttl: live.ttl() },
        ConditionExpression: 'attribute_not_exists(pk) OR #seq < :seq',
        ExpressionAttributeNames: { '#seq': 'seq' },
        ExpressionAttributeValues: { ':seq': input.seq },
      }),
    );
  } catch (error) {
    if (!isConditionalCheckFailure(error)) throw error;
    // A newer batch got there first: report what is stored.
    const current = await getRunner(live, session, player.id);
    return toResult(current ?? runner, now, place);
  }
  return toResult(runner, now, place);
}

/** Every runner of a round. */
export function listRunners(live: LiveService, sessionId: string, round: number): Promise<StoredRunner[]> {
  return live.queryShards<StoredRunner>((shard) => runnersPk(sessionId, round, shard));
}
