/**
 * Load test against a deployed stack: N players join, subscribe to AppSync Events and
 * answer Q questions. Reports join/answer latency and real-time fan-out delay.
 *
 *   AWS_PROFILE=... npx tsx scripts/load-test.ts --players 1000 --questions 3
 *
 * Reads endpoints from infra/cdk-outputs.<stage>.json.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createDb } from '@chacota/db';
import { connectRealtime, type RealtimeConnection } from '../src/client';
import { channels, QUESTION_LEAD_MS, type GameEvent } from '../src/model';
import { AppSyncPublisher } from '../src/realtime';
import { GameService } from '../src/service';

const { values } = parseArgs({
  options: {
    players: { type: 'string', default: '1000' },
    questions: { type: 'string', default: '3' },
    stage: { type: 'string', default: 'dev' },
    concurrency: { type: 'string', default: '100' },
  },
});
const N = Number(values.players);
const Q = Number(values.questions);
const CONCURRENCY = Number(values.concurrency);
const outputs = JSON.parse(readFileSync(new URL(`../../../infra/cdk-outputs.${values.stage}.json`, import.meta.url), 'utf8'))[
  `Chacota-${values.stage}`
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!) : NaN;
};
const summary = (label: string, xs: number[]) =>
  console.log(`  ${label.padEnd(28)} n=${String(xs.length).padStart(5)}  p50=${pct(xs, 50)}ms  p95=${pct(xs, 95)}ms  p99=${pct(xs, 99)}ms  max=${pct(xs, 100)}ms`);

async function pool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]!, i);
    }
  }));
}

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${outputs.GameApiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, string> };
}

// ---------- setup ----------
const publisher = new AppSyncPublisher(outputs.EventsHttpDns, 'us-east-1');
// Resolve credentials before opening 1000 sockets: SSO refreshes fail on a saturated laptop.
await publisher.publish('/game/warmup', { type: 'leaderboard', index: 0, top: [] });
const host = new GameService(createDb({ tableName: outputs.TableName }), publisher, { tokenSecret: 'host-only' });
const questions = Array.from({ length: Q }, (_, i) => ({
  id: `q${i}`,
  type: 'quiz' as const,
  prompt: `Pregunta de carga ${i + 1}`,
  timeLimitSec: 20,
  points: 'standard' as const,
  choices: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id.toUpperCase(), correct: id === 'a' })),
}));
const game = await host.createGame({
  orgId: 'load-test',
  orgName: 'Load test',
  hostUserId: 'load-test',
  tiluchi: { id: 'load', title: 'Load test', language: 'es', questions },
});
console.log(`game ${game.id} PIN ${game.pin} · ${N} players · ${Q} questions`);

// ---------- join + subscribe ----------
const joinLatency: number[] = [];
const errors = new Map<string, number>();
const countError = (k: string) => errors.set(k, (errors.get(k) ?? 0) + 1);
const players: { token: string; id: string; conn?: RealtimeConnection; received: Map<string, number> }[] = [];
const fanout = new Map<string, number[]>(); // event key -> delays


const t0 = Date.now();
await pool(Array.from({ length: N }, (_, i) => i), CONCURRENCY, async (i) => {
  const s = Date.now();
  const res = await post('/join', { pin: game.pin, nickname: `bot-${i}` }).catch((e: Error) => ({ status: 0, body: { error: String((e.cause as Error)?.message ?? e.message).slice(0, 60) } as Record<string, string> }));
  joinLatency.push(Date.now() - s);
  if (res.status !== 200) {
    countError(`join ${res.status} ${res.body.error ?? ''}`);
    return;
  }
  const player = { token: res.body.token!, id: res.body.playerId!, received: new Map<string, number>() };
  const conn = connectRealtime({ httpDns: outputs.EventsHttpDns, realtimeUrl: `wss://${outputs.EventsRealtimeDns}/event/realtime`, apiKey: outputs.EventsApiKey });
  conn.subscribe(channels.public(game.id), (e: GameEvent) => {
    const key = `${e.type}${'index' in e ? e.index : ''}`;
    player.received.set(key, Date.now());
    if (e.type === 'question') {
      // serverNow is stamped on this same machine (the host runs here), so the delay is exact.
      const list = fanout.get(key) ?? [];
      list.push(Date.now() - e.serverNow);
      fanout.set(key, list);
    }
  });
  players.push({ ...player, conn });
});
console.log(`joined ${players.length}/${N} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await sleep(5000); // let subscriptions settle

// ---------- play ----------
const answerLatency: number[] = [];
for (let q = 0; q < Q; q++) {
  await host.advance(game.id); // question

  await sleep(QUESTION_LEAD_MS + 100);
  // Everyone answers within ~5 seconds, like a real crowd.
  await Promise.all(players.map(async (p) => {
    await sleep(Math.random() * 5000);
    const s = Date.now();
    const value = Math.random() < 0.6 ? 'a' : ['b', 'c', 'd'][Math.floor(Math.random() * 3)]!;
    const res = await post('/answer', { questionIndex: q, value }, p.token).catch(() => ({ status: 0, body: {} as Record<string, string> }));
    answerLatency.push(Date.now() - s);
    if (res.status !== 200) countError(`answer ${res.status} ${res.body.error ?? ''}`);
  }));
  const counted = await host.countAnswers(game.id, q);
  const s = Date.now();
  await host.advance(game.id); // reveal
  await sleep(4000);
  const gotReveal = players.filter((p) => p.received.has(`reveal${q}`));
  const revealDelay = gotReveal.map((p) => p.received.get(`reveal${q}`)! - s);
  console.log(`question ${q + 1}: stored ${counted} answers · reveal delivered to ${gotReveal.length}/${players.length}`);
  fanout.set(`reveal${q}`, revealDelay);
  await host.advance(game.id); // leaderboard
}
await host.end(game.id);

// ---------- report ----------
console.log('\nlatency');
summary('join (HTTP)', joinLatency);
summary('answer (HTTP)', answerLatency);
for (const [key, delays] of fanout) summary(`fan-out ${key}`, delays);
console.log('\nerrors', errors.size ? Object.fromEntries(errors) : 'none');
players.forEach((p) => p.conn?.close());
process.exit(0);
