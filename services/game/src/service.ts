import { randomInt } from 'node:crypto';
import { GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { newId } from '@chacota/core';
import { computePoints, isAnswerCorrect, PlayableTiluchi, type Tiluchi } from '@chacota/tiluchi/content';
import { isConditionalCheckFailure, type Db } from '@chacota/db';
import { buildResults, countAnswers, correctValues, publicQuestion, rankPlayers, topStandings, validAnswerValues } from './engine';
import { ANSWER_GRACE_MS, QUESTION_LEAD_MS, channels, NICKNAME_MAX, type Answer, type Game, type GameEvent, type GameResults, type GameResultsSummary, type GameStatus, type Player } from './model';
import type { Publisher } from './realtime';
import { signPlayerToken, verifyPlayerToken } from './token';

export class GameError extends Error {
  constructor(
    readonly code:
      | 'game_not_found'
      | 'game_ended'
      | 'nickname_taken'
      | 'invalid_nickname'
      | 'invalid_token'
      | 'not_accepting_answers'
      | 'wrong_question'
      | 'already_answered'
      | 'invalid_answer'
      | 'invalid_transition'
      | 'not_playable',
  ) {
    super(code);
    this.name = 'GameError';
  }
}

/**
 * Players, nicknames and answers are spread over SHARDS partition keys: DynamoDB allows about
 * 1000 writes/second per partition key, and a 1000-player game writes faster than that.
 */
export const SHARDS = 10;

export function shardOf(value: string): number {
  // FNV-1a: cheap and stable across runtimes.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % SHARDS;
}

const pad = (index: number) => String(index).padStart(3, '0');

const k = {
  game: (id: string) => ({ pk: `GAME#${id}`, sk: 'META' }),
  pin: (pin: string) => ({ pk: `PIN#${pin}`, sk: 'PIN' }),
  playersPk: (gameId: string, shard: number) => `GAME#${gameId}#P${shard}`,
  player: (gameId: string, playerId: string) => ({ pk: k.playersPk(gameId, shardOf(playerId)), sk: `PLAYER#${playerId}` }),
  nickname: (gameId: string, nickname: string) => {
    const lower = nickname.toLocaleLowerCase();
    return { pk: `GAME#${gameId}#N${shardOf(lower)}`, sk: `NICK#${lower}` };
  },
  answersPk: (gameId: string, index: number, shard: number) => `GAME#${gameId}#A${pad(index)}#${shard}`,
  answer: (gameId: string, index: number, playerId: string) => ({
    pk: k.answersPk(gameId, index, shardOf(playerId)),
    sk: `ANSWER#${playerId}`,
  }),
  // Results live under the organization and never expire.
  result: (orgId: string, endedAt: string, gameId: string) => ({ pk: `ORG#${orgId}`, sk: `RESULT#${endedAt}#${gameId}` }),
  resultRows: (orgId: string, gameId: string, chunk: number) => ({ pk: `ORG#${orgId}`, sk: `RESROWS#${gameId}#${pad(chunk)}` }),
};

/** Standings are stored in chunks so a big game never hits the 400KB item limit. */
const ROWS_PER_CHUNK = 500;

const HOUR = 3600;
/** Live data (PIN, players, answers) expires; the game record stays as history. */
const LIVE_TTL_SECONDS = 48 * HOUR;

function strip<T>(item: Record<string, unknown>): T {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g2, ttl: _ttl, ...rest } = item;
  return rest as T;
}

export interface GameServiceOptions {
  tokenSecret: string;
  now?: () => number;
}

export interface JoinResult {
  token: string;
  player: Player;
  gameId: string;
}

export class GameService {
  private readonly now: () => number;

  constructor(
    private readonly db: Db,
    private readonly publisher: Publisher,
    private readonly options: GameServiceOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  private ttl() {
    return Math.floor(this.now() / 1000) + LIVE_TTL_SECONDS;
  }

  private publish(gameId: string, event: GameEvent, channel = channels.public(gameId)) {
    return this.publisher.publish(channel, event);
  }

  // ---------- host ----------

  async createGame(input: {
    orgId: string;
    orgName: string;
    primaryColor?: string;
    tiluchi: Tiluchi;
    hostUserId: string;
  }): Promise<Game> {
    const playable = PlayableTiluchi.safeParse(input.tiluchi);
    if (!playable.success) throw new GameError('not_playable');

    for (let attempt = 0; attempt < 10; attempt++) {
      const game: Game = {
        id: newId(),
        pin: String(randomInt(100_000, 1_000_000)),
        orgId: input.orgId,
        tiluchiId: input.tiluchi.id,
        hostUserId: input.hostUserId,
        title: input.tiluchi.title,
        orgName: input.orgName,
        primaryColor: input.primaryColor,
        questions: playable.data.questions,
        status: 'lobby',
        questionIndex: -1,
        playerCount: 0,
        createdAt: new Date(this.now()).toISOString(),
      };
      try {
        await this.db.doc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: this.db.tableName,
                  Item: { ...k.pin(game.pin), gameId: game.id, ttl: this.ttl() },
                  // A PIN can be reused once its previous game expired.
                  ConditionExpression: 'attribute_not_exists(pk) OR #ttl < :now',
                  ExpressionAttributeNames: { '#ttl': 'ttl' },
                  ExpressionAttributeValues: { ':now': Math.floor(this.now() / 1000) },
                },
              },
              {
                Put: {
                  TableName: this.db.tableName,
                  Item: { ...k.game(game.id), ...game, gsi1pk: `ORGGAMES#${game.orgId}`, gsi1sk: game.createdAt },
                },
              },
            ],
          }),
        );
        return game;
      } catch (error) {
        if (!isConditionalCheckFailure(error)) throw error;
      }
    }
    throw new Error('Could not allocate a free PIN');
  }

  async getGame(gameId: string): Promise<Game | undefined> {
    const { Item } = await this.db.doc.send(
      new GetCommand({ TableName: this.db.tableName, Key: k.game(gameId), ConsistentRead: true }),
    );
    return Item ? strip<Game>(Item) : undefined;
  }

  async findGameIdByPin(pin: string): Promise<string | undefined> {
    const { Item } = await this.db.doc.send(new GetCommand({ TableName: this.db.tableName, Key: k.pin(pin) }));
    if (!Item || (Item.ttl as number) < Math.floor(this.now() / 1000)) return undefined;
    return Item.gameId as string;
  }

  /** Moves the game forward: lobby/leaderboard → next question, question → reveal, reveal → leaderboard. */
  async advance(gameId: string): Promise<Game> {
    const game = await this.requireGame(gameId);
    switch (game.status) {
      case 'lobby':
      case 'leaderboard':
        return game.questionIndex + 1 < game.questions.length ? this.startQuestion(game) : this.end(game.id);
      case 'question':
        return this.reveal(game);
      case 'reveal':
        return this.showLeaderboard(game);
      case 'ended':
        throw new GameError('game_ended');
    }
  }

  private async transition(game: Game, to: GameStatus, changes: Record<string, unknown> = {}): Promise<Game> {
    const entries = Object.entries({ ...changes, status: to });
    const names = Object.fromEntries(entries.map(([key], i) => [`#f${i}`, key]));
    const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]));
    try {
      const { Attributes } = await this.db.doc.send(
        new UpdateCommand({
          TableName: this.db.tableName,
          Key: k.game(game.id),
          // Guards against double clicks and two presenters racing each other.
          ConditionExpression: '#status = :fromStatus AND questionIndex = :fromIndex',
          UpdateExpression: `SET ${entries.map((_, i) => `#f${i} = :v${i}`).join(', ')}`,
          ExpressionAttributeNames: { ...names, '#status': 'status' },
          ExpressionAttributeValues: { ...values, ':fromStatus': game.status, ':fromIndex': game.questionIndex },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return strip<Game>(Attributes!);
    } catch (error) {
      if (isConditionalCheckFailure(error)) throw new GameError('invalid_transition');
      throw error;
    }
  }

  private async startQuestion(game: Game): Promise<Game> {
    const index = game.questionIndex + 1;
    // Answers open after a short reading time; everyone gets the same head start.
    const startedAt = this.now() + QUESTION_LEAD_MS;
    const updated = await this.transition(game, 'question', { questionIndex: index, questionStartedAt: startedAt });
    await this.publish(game.id, {
      type: 'question',
      index,
      total: game.questions.length,
      question: publicQuestion(game.questions[index]!),
      startedAt,
      serverNow: this.now(),
    });
    return updated;
  }

  private async reveal(game: Game): Promise<Game> {
    const question = game.questions[game.questionIndex]!;
    const updated = await this.transition(game, 'reveal');
    const [answers, players] = await Promise.all([this.listAnswers(game.id, game.questionIndex), this.listPlayers(game.id)]);
    await this.resetStreaksOfSilentPlayers(game.id, players, answers);
    await this.publish(game.id, {
      type: 'reveal',
      index: game.questionIndex,
      correct: correctValues(question),
      counts: countAnswers(question, answers),
      answered: answers.length,
      top: topStandings(players),
      ranks: rankPlayers(players, answers),
    });
    return updated;
  }

  private async showLeaderboard(game: Game): Promise<Game> {
    const updated = await this.transition(game, 'leaderboard');
    const players = await this.listPlayers(game.id);
    await this.publish(game.id, { type: 'leaderboard', index: game.questionIndex, top: topStandings(players) });
    return updated;
  }

  async end(gameId: string): Promise<Game> {
    const game = await this.requireGame(gameId);
    if (game.status === 'ended') {
      // A previous attempt may have failed after the transition: make sure results exist.
      if (!(await this.getResultsSummary(game))) await this.saveResults(game);
      return game;
    }
    const updated = await this.transition(game, 'ended', { endedAt: new Date(this.now()).toISOString() });
    const players = await this.saveResults(updated);
    await this.publish(game.id, { type: 'ended', podium: topStandings(players, 3), ranks: rankPlayers(players) });
    return updated;
  }

  /** Writes the permanent results of an ended game. Idempotent. Returns the players it read. */
  private async saveResults(game: Game): Promise<Player[]> {
    const played = game.status === 'lobby' ? 0 : game.questionIndex + 1;
    const [players, ...answers] = await Promise.all([
      this.listPlayers(game.id),
      ...Array.from({ length: Math.max(0, played) }, (_, i) => this.listAnswers(game.id, i)),
    ]);
    // Nobody played: nothing worth keeping in the history.
    if (players.length === 0) return [];
    const { standings, ...summary } = buildResults(game, players as Player[], answers as Answer[][], game.endedAt!);
    const chunks = Array.from({ length: Math.ceil(standings.length / ROWS_PER_CHUNK) }, (_, i) =>
      standings.slice(i * ROWS_PER_CHUNK, (i + 1) * ROWS_PER_CHUNK),
    );
    try {
      await this.db.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.db.tableName,
                Item: { ...k.result(game.orgId, game.endedAt!, game.id), ...summary, chunks: chunks.length },
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
            ...chunks.map((rows, i) => ({
              Put: { TableName: this.db.tableName, Item: { ...k.resultRows(game.orgId, game.id, i), rows } },
            })),
          ],
        }),
      );
    } catch (error) {
      if (!isConditionalCheckFailure(error)) throw error;
    }
    return players as Player[];
  }

  /** Most recent results of an organization first, without the standings. */
  async listResults(orgId: string, limit = 100): Promise<GameResultsSummary[]> {
    const { Items } = await this.db.doc.send(
      new QueryCommand({
        TableName: this.db.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': `ORG#${orgId}`, ':prefix': 'RESULT#' },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (Items ?? []).map((i) => strip<GameResultsSummary & { chunks?: number }>(i)).map(({ chunks: _c, ...r }) => r);
  }

  private async getResultsSummary(game: Game): Promise<(Omit<GameResults, 'standings'> & { chunks: number }) | undefined> {
    if (!game.endedAt) return undefined;
    const { Item } = await this.db.doc.send(
      new GetCommand({ TableName: this.db.tableName, Key: k.result(game.orgId, game.endedAt, game.id), ConsistentRead: true }),
    );
    return Item ? strip(Item) : undefined;
  }

  /** Full results of an ended game, or undefined if it never ended. */
  async getResults(game: Game): Promise<GameResults | undefined> {
    const summary = await this.getResultsSummary(game);
    if (!summary) return undefined;
    const { chunks, ...rest } = summary;
    const { Items } = await this.db.doc.send(
      new QueryCommand({
        TableName: this.db.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': `ORG#${game.orgId}`, ':prefix': `RESROWS#${game.id}#` },
        ConsistentRead: true,
      }),
    );
    const rows = (Items ?? []).sort((a, b) => String(a.sk).localeCompare(String(b.sk)));
    if (rows.length !== chunks) throw new Error(`Results of game ${game.id} are incomplete`);
    return { ...rest, standings: rows.flatMap((r) => r.rows as GameResults['standings']) };
  }

  /** Games of an organization that started but were never ended (results not saved yet). */
  async listUnfinishedGames(orgId: string): Promise<Game[]> {
    const { Items } = await this.db.doc.send(
      new QueryCommand({
        TableName: this.db.tableName,
        IndexName: 'gsi1',
        // Older games lost their players and answers to the TTL.
        KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk > :since',
        FilterExpression: '#status <> :ended AND playerCount > :zero',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `ORGGAMES#${orgId}`,
          ':since': new Date(this.now() - LIVE_TTL_SECONDS * 1000).toISOString(),
          ':ended': 'ended',
          ':zero': 0,
        },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );
    return (Items ?? []).map((i) => strip<Game>(i));
  }

  async countAnswers(gameId: string, index: number): Promise<number> {
    const counts = await Promise.all(
      Array.from({ length: SHARDS }, async (_, shard) => {
        let count = 0;
        let start: Record<string, unknown> | undefined;
        do {
          const page = await this.db.doc.send(
            new QueryCommand({
              TableName: this.db.tableName,
              KeyConditionExpression: 'pk = :pk',
              ExpressionAttributeValues: { ':pk': k.answersPk(gameId, index, shard) },
              Select: 'COUNT',
              ExclusiveStartKey: start,
            }),
          );
          count += page.Count ?? 0;
          start = page.LastEvaluatedKey;
        } while (start);
        return count;
      }),
    );
    return counts.reduce((a, b) => a + b, 0);
  }

  // ---------- players ----------

  async join(pin: string, rawNickname: string): Promise<JoinResult> {
    const nickname = rawNickname.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (nickname.length < 1 || nickname.length > NICKNAME_MAX) throw new GameError('invalid_nickname');

    const gameId = await this.findGameIdByPin(pin);
    const game = gameId && (await this.getGame(gameId));
    if (!game) throw new GameError('game_not_found');
    if (game.status === 'ended') throw new GameError('game_ended');

    const player: Player = { id: newId(), gameId: game.id, nickname, score: 0, streak: 0, joinedAt: this.now() };
    try {
      await this.db.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.db.tableName,
                Item: { ...k.nickname(game.id, nickname), playerId: player.id, ttl: this.ttl() },
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
            { Put: { TableName: this.db.tableName, Item: { ...k.player(game.id, player.id), ...player, ttl: this.ttl() } } },
          ],
        }),
      );
    } catch (error) {
      if (isConditionalCheckFailure(error)) throw new GameError('nickname_taken');
      throw error;
    }
    // Kept outside the transaction: hundreds of players join at once, and transactions touching
    // the same game item would conflict. A plain atomic ADD never does.
    const { Attributes } = await this.db.doc.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: k.game(game.id),
        UpdateExpression: 'ADD playerCount :one',
        ExpressionAttributeValues: { ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    await this.publish(
      game.id,
      { type: 'player_joined', nickname, playerCount: Number(Attributes?.playerCount ?? game.playerCount + 1) },
      channels.host(game.id),
    );
    return { token: signPlayerToken(this.options.tokenSecret, game.id, player.id), player, gameId: game.id };
  }

  verifyToken(token: string): { gameId: string; playerId: string } {
    const claims = verifyPlayerToken(this.options.tokenSecret, token);
    if (!claims) throw new GameError('invalid_token');
    return claims;
  }

  async getPlayer(gameId: string, playerId: string): Promise<Player | undefined> {
    const { Item } = await this.db.doc.send(
      new GetCommand({ TableName: this.db.tableName, Key: k.player(gameId, playerId), ConsistentRead: true }),
    );
    return Item ? strip<Player>(Item) : undefined;
  }

  /** Scores an answer with the server clock. Each player answers each question at most once. */
  async answer(token: string, input: { questionIndex: number; value: string }): Promise<{ accepted: true }> {
    const { gameId, playerId } = this.verifyToken(token);
    const receivedAt = this.now();
    const [game, player] = await Promise.all([this.getGame(gameId), this.getPlayer(gameId, playerId)]);
    if (!game || !player) throw new GameError('game_not_found');
    if (game.status !== 'question' || game.questionStartedAt === undefined) throw new GameError('not_accepting_answers');
    if (input.questionIndex !== game.questionIndex) throw new GameError('wrong_question');

    const question = game.questions[game.questionIndex]!;
    if (!validAnswerValues(question).includes(input.value)) throw new GameError('invalid_answer');
    const timeLimitMs = question.timeLimitSec * 1000;
    const elapsedMs = receivedAt - game.questionStartedAt;
    // Small tolerance for clock-offset estimation on the client.
    if (elapsedMs < -500) throw new GameError('not_accepting_answers');
    if (elapsedMs > timeLimitMs + ANSWER_GRACE_MS) throw new GameError('not_accepting_answers');

    const correct = isAnswerCorrect(question, input.value);
    const streak = correct ? player.streak + 1 : 0;
    const points = computePoints({ correct, elapsedMs, timeLimitMs, points: question.points, streak });
    const answer: Answer = { gameId, playerId, questionIndex: game.questionIndex, value: input.value, elapsedMs, correct, points };

    try {
      await this.db.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.db.tableName,
                Item: { ...k.answer(gameId, game.questionIndex, playerId), ...answer, ttl: this.ttl() },
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
            {
              Update: {
                TableName: this.db.tableName,
                Key: k.player(gameId, playerId),
                UpdateExpression: 'ADD score :points SET streak = :streak',
                ExpressionAttributeValues: { ':points': points, ':streak': question.type === 'poll' ? player.streak : streak },
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (isConditionalCheckFailure(error)) throw new GameError('already_answered');
      throw error;
    }
    return { accepted: true };
  }

  // ---------- reads ----------

  async listPlayers(gameId: string): Promise<Player[]> {
    return this.queryShards<Player>((shard) => k.playersPk(gameId, shard));
  }

  async listAnswers(gameId: string, index: number): Promise<Answer[]> {
    return this.queryShards<Answer>((shard) => k.answersPk(gameId, index, shard));
  }

  async getAnswer(gameId: string, index: number, playerId: string): Promise<Answer | undefined> {
    const { Item } = await this.db.doc.send(
      new GetCommand({ TableName: this.db.tableName, Key: k.answer(gameId, index, playerId), ConsistentRead: true }),
    );
    return Item ? strip<Answer>(Item) : undefined;
  }

  private async queryShards<T>(pkOf: (shard: number) => string): Promise<T[]> {
    const pages = await Promise.all(
      Array.from({ length: SHARDS }, async (_, shard) => {
        const items: T[] = [];
        let start: Record<string, unknown> | undefined;
        do {
          const page = await this.db.doc.send(
            new QueryCommand({
              TableName: this.db.tableName,
              KeyConditionExpression: 'pk = :pk',
              ExpressionAttributeValues: { ':pk': pkOf(shard) },
              ConsistentRead: true,
              ExclusiveStartKey: start,
            }),
          );
          items.push(...(page.Items ?? []).map((i) => strip<T>(i)));
          start = page.LastEvaluatedKey;
        } while (start);
        return items;
      }),
    );
    return pages.flat();
  }

  /** A player who skips a question loses their streak. */
  private async resetStreaksOfSilentPlayers(gameId: string, players: Player[], answers: Answer[]) {
    const answered = new Set(answers.map((a) => a.playerId));
    const silent = players.filter((p) => p.streak > 0 && !answered.has(p.id));
    await Promise.all(
      silent.map((p) =>
        this.db.doc.send(
          new UpdateCommand({
            TableName: this.db.tableName,
            Key: k.player(gameId, p.id),
            UpdateExpression: 'SET streak = :zero',
            ExpressionAttributeValues: { ':zero': 0 },
          }),
        ),
      ),
    );
    for (const p of silent) p.streak = 0;
  }

  private async requireGame(gameId: string): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) throw new GameError('game_not_found');
    return game;
  }
}

/** Snapshot a reconnecting client needs to render the current screen. */
export async function gameSnapshot(service: GameService, game: Game, playerId?: string) {
  const question = game.questionIndex >= 0 ? game.questions[game.questionIndex] : undefined;
  const player = playerId ? await service.getPlayer(game.id, playerId) : undefined;
  const answer = playerId && question ? await service.getAnswer(game.id, game.questionIndex, playerId) : undefined;
  return {
    game: {
      id: game.id,
      title: game.title,
      orgName: game.orgName,
      primaryColor: game.primaryColor,
      status: game.status,
      index: game.questionIndex,
      total: game.questions.length,
      startedAt: game.questionStartedAt,
      question: question && game.status === 'question' ? publicQuestion(question) : undefined,
    },
    player: player && { id: player.id, nickname: player.nickname, score: player.score },
    answered: answer ? { value: answer.value } : undefined,
    serverNow: Date.now(),
  };
}

export type GameSnapshot = Awaited<ReturnType<typeof gameSnapshot>>;
