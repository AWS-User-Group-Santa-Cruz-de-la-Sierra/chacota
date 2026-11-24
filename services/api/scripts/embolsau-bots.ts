/**
 * Fills an Embolsau race with bots, to see the crowd on the presenter's screen.
 * Start a race from the web, then:
 *
 *   npx tsx scripts/embolsau-bots.ts --pin 123456 --players 99 [--api http://localhost:4000]
 *
 * Each bot joins, picks a random critter when it can, and pushes once a second at its own pace
 * (some calm, some frantic). Stops when the session ends or with Ctrl+C.
 */
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    pin: { type: 'string' },
    players: { type: 'string', default: '99' },
    api: { type: 'string', default: 'http://localhost:4000' },
  },
});
if (!values.pin) throw new Error('--pin is required');
const API = values.api!;
const ANIMALS = ['jochi', 'tatu', 'nandu', 'capibara'];

const post = (path: string, body: unknown, token?: string) =>
  fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

async function bot(i: number) {
  const joined = await post('/join', { pin: values.pin, nickname: `Bot ${i + 1}` });
  if (!joined.ok) return console.log(`bot ${i + 1}: ${(await joined.json()).error}`);
  const { token } = (await joined.json()) as { token: string };
  const rate = 3 + Math.random() * 9; // taps per second: 3 (calm) … 12 (frantic)
  const animal = ANIMALS[i % ANIMALS.length];
  let picked = false;
  let seq = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 200));
    if (!picked) picked = (await post('/m/embolsau/pick', { animal }, token)).ok;
    const taps = Math.round(rate * (0.7 + Math.random() * 0.6));
    const ago = Array.from({ length: taps }, () => Math.round(Math.random() * 999));
    const res = await post('/m/embolsau/push', { seq: ++seq, ago }, token);
    if (res.status === 404 || (await res.json().catch(() => ({}))).error === 'session_ended') return;
  }
}

await Promise.all(Array.from({ length: Number(values.players) }, (_, i) => bot(i)));
