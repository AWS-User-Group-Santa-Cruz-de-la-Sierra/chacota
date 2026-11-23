/**
 * Load test that runs inside AWS (deployed by infra with -c chacota:loadTest=true).
 * One orchestrator invocation hosts the game and fans out to worker invocations,
 * each simulating a batch of players with their own WebSocket subscription.
 *
 *   aws lambda invoke --function-name <LoadTestFunction> \
 *     --payload '{"role":"orchestrator","players":1000,"questions":3}' --cli-binary-format raw-in-base64-out out.json
 */
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { dbFromEnv } from '@chacota/db';
import { connectRealtime, type RealtimeConnection } from '../src/client';
import { channels, QUESTION_LEAD_MS, type GameEvent } from '../src/model';
import { AppSyncPublisher } from '../src/realtime';
import { GameService } from '../src/service';

const env = {
  apiUrl: process.env.GAME_API_URL!,
  httpDns: process.env.EVENTS_HTTP_DNS!,
  realtimeDns: process.env.EVENTS_REALTIME_DNS!,
  apiKey: process.env.EVENTS_API_KEY!,
  functionName: process.env.AWS_LAMBDA_FUNCTION_NAME!,
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PLAYERS_PER_WORKER = 100;

interface WorkerInput {
  role: 'worker';
  gameId: string;
  pin: string;
  players: number;
  offset: number;
}
interface WorkerResult {
  joined: number;
  joinMs: number[];
  answerMs: number[];
  questionDelayMs: number[];
  revealReceivedAt: Record<string, number[]>;
  endedReceived: number;
  errors: Record<string, number>;
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) await fn(items[next++]!);
  }));
}

async function worker(input: WorkerInput): Promise<WorkerResult> {
  const result: WorkerResult = { joined: 0, joinMs: [], answerMs: [], questionDelayMs: [], revealReceivedAt: {}, endedReceived: 0, errors: {} };
  const err = (k: string) => (result.errors[k] = (result.errors[k] ?? 0) + 1);
  const connections: RealtimeConnection[] = [];
  let ended = 0;

  await pool(Array.from({ length: input.players }, (_, i) => input.offset + i), 20, async (n) => {
    const start = Date.now();
    const res = await fetch(`${env.apiUrl}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin: input.pin, nickname: `bot-${n}` }),
    }).catch(() => undefined);
    result.joinMs.push(Date.now() - start);
    if (!res?.ok) {
      err(`join ${res?.status ?? "network"}`);
      return;
    }
    const { token } = (await res.json()) as { token: string };
    result.joined++;

    const conn = connectRealtime({ httpDns: env.httpDns, realtimeUrl: `wss://${env.realtimeDns}/event/realtime`, apiKey: env.apiKey });
    connections.push(conn);
    conn.subscribe(channels.public(input.gameId), (e: GameEvent) => {
      const now = Date.now();
      if (e.type === 'question') {
        result.questionDelayMs.push(now - e.serverNow);
        // Answer like a crowd: within 5 seconds after answers open.
        const wait = Math.max(0, e.startedAt - e.serverNow) + Math.random() * 5000;
        setTimeout(async () => {
          const s = Date.now();
          const value = ['a', 'b', 'c', 'd'][Math.floor(Math.random() * 4)];
          const r = await fetch(`${env.apiUrl}/answer`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ questionIndex: e.index, value }),
          }).catch(() => undefined);
          result.answerMs.push(Date.now() - s);
          if (!r?.ok) err(`answer ${r?.status ?? 'network'}`);
        }, wait);
      }
      if (e.type === 'reveal') (result.revealReceivedAt[e.index] ??= []).push(now);
      if (e.type === 'ended') {
        result.endedReceived++;
        ended++;
      }
    });
  });

  // Wait for the game to end (or give up after 8 minutes).
  const deadline = Date.now() + 8 * 60_000;
  while (ended < result.joined && Date.now() < deadline) await sleep(500);
  connections.forEach((c) => c.close());
  return result;
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!) : null;
};
const stats = (xs: number[]) => ({ n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), p99: pct(xs, 99), max: pct(xs, 100) });

async function orchestrator(input: { players: number; questions: number }) {
  const publisher = new AppSyncPublisher(env.httpDns, process.env.AWS_REGION!);
  const host = new GameService(dbFromEnv(), publisher, { tokenSecret: 'host-only' });
  const game = await host.createGame({
    orgId: 'load-test',
    orgName: 'Load test',
    hostUserId: 'load-test',
    tiluchi: {
      id: 'load',
      title: 'Load test',
      language: 'es',
      questions: Array.from({ length: input.questions }, (_, i) => ({
        id: `q${i}`,
        type: 'quiz' as const,
        prompt: `Pregunta ${i + 1}`,
        timeLimitSec: 20,
        points: 'standard' as const,
        choices: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id, correct: id === 'a' })),
      })),
    },
  });

  const lambda = new LambdaClient({});
  const workers = Math.ceil(input.players / PLAYERS_PER_WORKER);
  const workerResults = Promise.all(
    Array.from({ length: workers }, async (_, w) => {
      const payload: WorkerInput = {
        role: 'worker',
        gameId: game.id,
        pin: game.pin,
        players: Math.min(PLAYERS_PER_WORKER, input.players - w * PLAYERS_PER_WORKER),
        offset: w * PLAYERS_PER_WORKER,
      };
      const res = await lambda.send(new InvokeCommand({ FunctionName: env.functionName, Payload: JSON.stringify(payload) }));
      return JSON.parse(new TextDecoder().decode(res.Payload)) as WorkerResult;
    }),
  );

  // Wait until everyone joined (and subscribed), at most 2 minutes.
  const joinStart = Date.now();
  while (Date.now() - joinStart < 120_000) {
    const g = await host.getGame(game.id);
    if ((g?.playerCount ?? 0) >= input.players) break;
    await sleep(1000);
  }
  const joinSeconds = (Date.now() - joinStart) / 1000;
  await sleep(5000);

  const revealStart: number[] = [];
  const stored: number[] = [];
  for (let q = 0; q < input.questions; q++) {
    await host.advance(game.id);
    await sleep(QUESTION_LEAD_MS + 7000);
    stored.push(await host.countAnswers(game.id, q));
    revealStart.push(Date.now());
    await host.advance(game.id); // reveal
    await sleep(3000);
    await host.advance(game.id); // leaderboard
  }
  await host.end(game.id);

  const results = await workerResults;
  const all = (pick: (r: WorkerResult) => number[]) => results.flatMap(pick);
  const errors: Record<string, number> = {};
  for (const r of results) for (const [k, v] of Object.entries(r.errors ?? {})) errors[k] = (errors[k] ?? 0) + v;
  return {
    players: input.players,
    joined: results.reduce((s, r) => s + (r.joined ?? 0), 0),
    joinSeconds,
    answersStored: stored,
    endedDelivered: results.reduce((s, r) => s + (r.endedReceived ?? 0), 0),
    latencyMs: {
      join: stats(all((r) => r.joinMs ?? [])),
      answer: stats(all((r) => r.answerMs ?? [])),
      questionFanout: stats(all((r) => r.questionDelayMs ?? [])),
      ...Object.fromEntries(
        revealStart.map((t, q) => [`revealFanout${q + 1}`, stats(all((r) => (r.revealReceivedAt?.[q] ?? []).map((x) => x - t)))]),
      ),
    },
    errors,
  };
}

export async function handler(event: { role: 'orchestrator'; players: number; questions: number } | WorkerInput) {
  return event.role === 'worker' ? worker(event) : orchestrator(event);
}
