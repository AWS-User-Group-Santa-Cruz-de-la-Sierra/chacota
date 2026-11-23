import { randomInt } from 'node:crypto';
import { GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { newId } from '@chacota/core';
import { isConditionalCheckFailure, strip, type Db } from '@chacota/db';
import type { AnyActivityServer } from './activity';
import { LIVE_TTL_SECONDS, SHARDS, sessionKeys as k } from './keys';
import {
  channels,
  NICKNAME_MAX,
  playerCode,
  type LiveEvent,
  type ModuleResults,
  type Player,
  type ResultEntry,
  type Session,
  type SessionResults,
  type SessionResultsSummary,
  type SessionStatus,
} from './model';
import { rankPlayers, sortPlayers, topStandings } from './ranking';
import type { Publisher } from './realtime';
import { signPlayerToken, verifyPlayerToken } from './token';

export type LiveErrorCode =
  | 'session_not_found'
  | 'session_ended'
  | 'nickname_taken'
  | 'invalid_nickname'
  | 'invalid_token'
  | 'invalid_transition'
  | 'not_playable'
  | 'unknown_activity'
  | 'unknown_action'
  | 'activity_disabled';

export class LiveError extends Error {
  constructor(readonly code: LiveErrorCode) {
    super(code);
    this.name = 'LiveError';
  }
}

export interface LiveServiceOptions {
  tokenSecret: string;
  now?: () => number;
}

export interface JoinResult {
  token: string;
  player: Player;
  sessionId: string;
  module: string;
}

/** Standings are stored in chunks so a big session never hits the 400KB item limit. */
const ROWS_PER_CHUNK = 500;

type StoredSummary = SessionResultsSummary & Pick<SessionResults, 'columns' | 'details'> & { chunks: number };

/** Live sessions of any registered activity. */
export class LiveService {
  readonly now: () => number;
  private readonly activities: Map<string, AnyActivityServer>;

  constructor(
    readonly db: Db,
    private readonly publisher: Publisher,
    activities: AnyActivityServer[],
    private readonly options: LiveServiceOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.activities = new Map(activities.map((a) => [a.manifest.id, a]));
  }

  /** Expiry (epoch seconds) for live data. */
  ttl(): number {
    return Math.floor(this.now() / 1000) + LIVE_TTL_SECONDS;
  }

  activity(module: string): AnyActivityServer | undefined {
    return this.activities.get(module);
  }

  private requireActivity(module: string): AnyActivityServer {
    const activity = this.activity(module);
    if (!activity) throw new LiveError('unknown_activity');
    return activity;
  }

  publish(sessionId: string, event: LiveEvent, channel = channels.public(sessionId)): Promise<void> {
    return this.publisher.publish(channel, event);
  }

  // ---------- host ----------

  async createSession(input: {
    orgId: string;
    orgName: string;
    primaryColor?: string;
    hostUserId: string;
    module: string;
    content: unknown;
  }): Promise<Session> {
    const activity = this.requireActivity(input.module);
    const { title, state } = activity.prepare(input.content);

    for (let attempt = 0; attempt < 10; attempt++) {
      const session: Session = {
        id: newId(),
        pin: String(randomInt(100_000, 1_000_000)),
        orgId: input.orgId,
        module: input.module,
        title,
        hostUserId: input.hostUserId,
        orgName: input.orgName,
        primaryColor: input.primaryColor,
        status: 'lobby',
        version: 1,
        playerCount: 0,
        createdAt: new Date(this.now()).toISOString(),
        state,
      };
      try {
        await this.db.doc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: this.db.tableName,
                  Item: { ...k.pin(session.pin), sessionId: session.id, ttl: this.ttl() },
                  // A PIN can be reused once its previous session expired.
                  ConditionExpression: 'attribute_not_exists(pk) OR #ttl < :now',
                  ExpressionAttributeNames: { '#ttl': 'ttl' },
                  ExpressionAttributeValues: { ':now': Math.floor(this.now() / 1000) },
                },
              },
              {
                Put: {
                  TableName: this.db.tableName,
                  Item: { ...k.session(session.id), ...session, gsi1pk: k.orgSessions(session.orgId), gsi1sk: session.createdAt },
                },
              },
            ],
          }),
        );
        return session;
      } catch (error) {
        if (!isConditionalCheckFailure(error)) throw error;
      }
    }
    throw new Error('Could not allocate a free PIN');
  }

  async getSession<TState = unknown>(id: string): Promise<Session<TState> | undefined> {
    const { Item } = await this.db.doc.send(
      new GetCommand({ TableName: this.db.tableName, Key: k.session(id), ConsistentRead: true }),
    );
    return Item ? strip<Session<TState>>(Item) : undefined;
  }

  private async requireSession<TState = unknown>(id: string): Promise<Session<TState>> {
    const session = await this.getSession<TState>(id);
    if (!session) throw new LiveError('session_not_found');
    return session;
  }

  async findSessionIdByPin(pin: string): Promise<string | undefined> {
    const { Item } = await this.db.doc.send(new GetCommand({ TableName: this.db.tableName, Key: k.pin(pin) }));
    if (!Item || (Item.ttl as number) < Math.floor(this.now() / 1000)) return undefined;
    return Item.sessionId as string;
  }

  /** Moves the session forward: the lobby starts it, then the activity decides. */
  async advance<TState = unknown>(id: string): Promise<Session<TState>> {
    const session = await this.requireSession(id);
    if (session.status === 'ended') throw new LiveError('session_ended');
    const activity = this.requireActivity(session.module);
    let current = session;
    if (session.status === 'lobby') {
      current = await this.transition(session, { status: 'running' });
      await this.publish(id, { type: 'started', serverNow: this.now() });
    }
    return activity.advance(this, current) as Promise<Session<TState>>;
  }

  /**
   * Updates the session only if nobody else changed it since it was read: guards against double
   * clicks and two presenters racing each other.
   */
  async transition<TState>(
    session: Session<TState>,
    changes: { status?: SessionStatus; state?: TState; endedAt?: string },
  ): Promise<Session<TState>> {
    const entries = Object.entries(changes).filter(([, v]) => v !== undefined);
    const names = Object.fromEntries(entries.map(([key], i) => [`#f${i}`, key]));
    const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]));
    try {
      const { Attributes } = await this.db.doc.send(
        new UpdateCommand({
          TableName: this.db.tableName,
          Key: k.session(session.id),
          ConditionExpression: '#version = :version',
          UpdateExpression: `SET ${[...entries.map((_, i) => `#f${i} = :v${i}`), '#version = #version + :one'].join(', ')}`,
          ExpressionAttributeNames: { ...names, '#version': 'version' },
          ExpressionAttributeValues: { ...values, ':version': session.version, ':one': 1 },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return strip<Session<TState>>(Attributes!);
    } catch (error) {
      if (isConditionalCheckFailure(error)) throw new LiveError('invalid_transition');
      throw error;
    }
  }

  /** Ends the session and keeps its results. Idempotent. */
  async end<TState = unknown>(id: string): Promise<Session<TState>> {
    const session = await this.requireSession<TState>(id);
    if (session.status === 'ended') {
      // A previous attempt may have failed after the transition: make sure results exist.
      if (!(await this.getResultsSummary(session))) await this.saveResults(session);
      return session;
    }
    const updated = await this.transition(session, { status: 'ended', endedAt: new Date(this.now()).toISOString() });
    const players = await this.saveResults(updated);
    await this.publish(id, { type: 'ended', podium: topStandings(players, 3), ranks: rankPlayers(players) });
    return updated;
  }

  async hostAction(id: string, name: string, args: unknown): Promise<unknown> {
    const session = await this.requireSession(id);
    const action = this.requireActivity(session.module).hostActions?.[name];
    if (!action) throw new LiveError('unknown_action');
    return action(this, session, args);
  }

  // ---------- players ----------

  async join(pin: string, rawNickname: string): Promise<JoinResult> {
    const nickname = rawNickname.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (nickname.length < 1 || nickname.length > NICKNAME_MAX) throw new LiveError('invalid_nickname');

    const sessionId = await this.findSessionIdByPin(pin);
    const session = sessionId && (await this.getSession(sessionId));
    if (!session) throw new LiveError('session_not_found');
    if (session.status === 'ended') throw new LiveError('session_ended');

    const player: Player = { id: newId(), sessionId: session.id, nickname, score: 0, joinedAt: this.now() };
    try {
      await this.db.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.db.tableName,
                Item: { ...k.nickname(session.id, nickname), playerId: player.id, ttl: this.ttl() },
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
            { Put: { TableName: this.db.tableName, Item: { ...k.player(session.id, player.id), ...player, ttl: this.ttl() } } },
          ],
        }),
      );
    } catch (error) {
      if (isConditionalCheckFailure(error)) throw new LiveError('nickname_taken');
      throw error;
    }
    // Kept outside the transaction: hundreds of players join at once, and transactions touching
    // the same session item would conflict. A plain atomic ADD never does.
    const { Attributes } = await this.db.doc.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: k.session(session.id),
        UpdateExpression: 'ADD playerCount :one',
        ExpressionAttributeValues: { ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    await this.publish(
      session.id,
      { type: 'player_joined', nickname, playerCount: Number(Attributes?.playerCount ?? session.playerCount + 1) },
      channels.host(session.id),
    );
    return {
      token: signPlayerToken(this.options.tokenSecret, session.id, player.id),
      player,
      sessionId: session.id,
      module: session.module,
    };
  }

  verifyToken(token: string): { sessionId: string; playerId: string } {
    const claims = verifyPlayerToken(this.options.tokenSecret, token);
    if (!claims) throw new LiveError('invalid_token');
    return claims;
  }

  async getPlayer(sessionId: string, playerId: string): Promise<Player | undefined> {
    const { Item } = await this.db.doc.send(
      new GetCommand({ TableName: this.db.tableName, Key: k.player(sessionId, playerId), ConsistentRead: true }),
    );
    return Item ? strip<Player>(Item) : undefined;
  }

  async listPlayers(sessionId: string): Promise<Player[]> {
    return this.queryShards<Player>((shard) => k.playersPk(sessionId, shard));
  }

  async addScore(sessionId: string, playerId: string, points: number): Promise<void> {
    await this.db.doc.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: k.player(sessionId, playerId),
        UpdateExpression: 'ADD score :points',
        ExpressionAttributeValues: { ':points': points },
      }),
    );
  }

  /** Reads every shard of a sharded partition in parallel. */
  async queryShards<T>(pkOf: (shard: number) => string): Promise<T[]> {
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

  /** What a reconnecting client (player, or presenter without playerId) needs to render. */
  async snapshot(id: string, playerId?: string) {
    const session = await this.requireSession(id);
    const activity = this.activity(session.module);
    const player = playerId ? await this.getPlayer(id, playerId) : undefined;
    return {
      session: {
        id: session.id,
        title: session.title,
        orgName: session.orgName,
        primaryColor: session.primaryColor,
        status: session.status,
        module: session.module,
        playerCount: session.playerCount,
      },
      player: player && { id: player.id, nickname: player.nickname, score: player.score },
      module: activity && session.status !== 'ended' ? await activity.snapshot(this, session, playerId) : {},
      serverNow: this.now(),
    };
  }

  // ---------- results ----------

  /** Writes the permanent results of an ended session. Idempotent. Returns the players it read. */
  private async saveResults(session: Session<unknown>): Promise<Player[]> {
    const players = await this.listPlayers(session.id);
    // Nobody played: nothing worth keeping in the history.
    if (players.length === 0) return [];
    const activity = this.activity(session.module);
    const moduleResults: ModuleResults = activity
      ? await activity.results(this, session, players)
      : { columns: [], extra: {}, details: null };
    const ranks = rankPlayers(players);
    const standings: ResultEntry[] = sortPlayers(players).map((p) => ({
      rank: ranks[p.id]!.rank,
      nickname: p.nickname,
      code: playerCode(p.id),
      score: p.score,
      extra: moduleResults.extra[p.id] ?? {},
    }));
    const chunks = Array.from({ length: Math.ceil(standings.length / ROWS_PER_CHUNK) }, (_, i) =>
      standings.slice(i * ROWS_PER_CHUNK, (i + 1) * ROWS_PER_CHUNK),
    );
    const summary: StoredSummary = {
      sessionId: session.id,
      orgId: session.orgId,
      module: session.module,
      title: session.title,
      hostUserId: session.hostUserId,
      createdAt: session.createdAt,
      endedAt: session.endedAt!,
      playerCount: players.length,
      podium: topStandings(players, 3),
      columns: moduleResults.columns,
      details: moduleResults.details,
      chunks: chunks.length,
    };
    try {
      await this.db.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.db.tableName,
                Item: { ...k.result(session.orgId, session.endedAt!, session.id), ...summary },
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
            ...chunks.map((rows, i) => ({
              Put: { TableName: this.db.tableName, Item: { ...k.resultRows(session.orgId, session.id, i), rows } },
            })),
          ],
        }),
      );
    } catch (error) {
      if (!isConditionalCheckFailure(error)) throw error;
    }
    return players;
  }

  private async getResultsSummary(session: Session<unknown>): Promise<StoredSummary | undefined> {
    if (!session.endedAt) return undefined;
    const { Item } = await this.db.doc.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: k.result(session.orgId, session.endedAt, session.id),
        ConsistentRead: true,
      }),
    );
    return Item ? strip<StoredSummary>(Item) : undefined;
  }

  /** Most recent results of an organization first, without the standings. */
  async listResults(orgId: string, limit = 100): Promise<SessionResultsSummary[]> {
    const { Items } = await this.db.doc.send(
      new QueryCommand({
        TableName: this.db.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': `ORG#${orgId}`, ':prefix': 'RESULT#' },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (
      (Items ?? [])
        // Results saved before activities existed (dev data only) have no module: skip them.
        .filter((item) => typeof item.module === 'string')
        .map((item) => {
          const { columns: _c, details: _d, chunks: _n, ...summary } = strip<StoredSummary>(item);
          return summary;
        })
    );
  }

  /** Full results of an ended session, or undefined if it never ended (or nobody played). */
  async getResults(session: Session<unknown>): Promise<SessionResults | undefined> {
    const stored = await this.getResultsSummary(session);
    if (!stored) return undefined;
    const { chunks, ...summary } = stored;
    const { Items } = await this.db.doc.send(
      new QueryCommand({
        TableName: this.db.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': `ORG#${session.orgId}`, ':prefix': `RESROWS#${session.id}#` },
        ConsistentRead: true,
      }),
    );
    const rows = (Items ?? []).sort((a, b) => String(a.sk).localeCompare(String(b.sk)));
    if (rows.length !== chunks) throw new Error(`Results of session ${session.id} are incomplete`);
    return { ...summary, standings: rows.flatMap((r) => r.rows as ResultEntry[]) };
  }

  /** Sessions that started, have players and were never ended (results not saved yet). */
  async listUnfinishedSessions(orgId: string): Promise<Session[]> {
    const { Items } = await this.db.doc.send(
      new QueryCommand({
        TableName: this.db.tableName,
        IndexName: 'gsi1',
        // Older sessions lost their players to the TTL.
        KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk > :since',
        FilterExpression: '#status <> :ended AND playerCount > :zero',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': k.orgSessions(orgId),
          ':since': new Date(this.now() - LIVE_TTL_SECONDS * 1000).toISOString(),
          ':ended': 'ended',
          ':zero': 0,
        },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );
    return (Items ?? []).map((i) => strip<Session>(i));
  }
}

export type LiveSnapshot = Awaited<ReturnType<LiveService['snapshot']>>;
