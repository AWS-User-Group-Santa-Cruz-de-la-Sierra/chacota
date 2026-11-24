import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPushLoop, type PushBatch } from '../src/web/use-push-loop';

beforeEach(() => vi.useFakeTimers({ now: 0 }));
afterEach(() => vi.useRealTimers());

describe('push loop', () => {
  it('sends the taps of each interval with how long ago they happened', async () => {
    const sent: PushBatch[] = [];
    const loop = createPushLoop({ send: async (b) => void sent.push(b), now: () => Date.now(), intervalMs: 1000 });
    vi.advanceTimersByTime(100);
    loop.tap();
    vi.advanceTimersByTime(400);
    loop.tap();
    loop.tap();
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toEqual([{ seq: 1, ago: [900, 500, 500] }]);
    loop.stop();
  });

  it('sends even without taps, so the phone keeps learning its place', async () => {
    const sent: PushBatch[] = [];
    const loop = createPushLoop({ send: async (b) => void sent.push(b), now: () => Date.now(), intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent.map((b) => b.seq)).toEqual([1, 2]);
    expect(sent.every((b) => b.ago.length === 0)).toBe(true);
    loop.stop();
  });

  it('carries the taps of a failed send into the next one', async () => {
    const sent: PushBatch[] = [];
    let fail = true;
    const loop = createPushLoop({
      send: async (b) => {
        sent.push(b);
        if (fail) {
          fail = false;
          throw new Error('offline');
        }
      },
      now: () => Date.now(),
      intervalMs: 1000,
    });
    vi.advanceTimersByTime(500);
    loop.tap();
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent[1]).toEqual({ seq: 2, ago: [1500] });
    loop.stop();
  });

  it('drops taps the server would no longer accept (older than 3 s, more than 40)', async () => {
    const sent: PushBatch[] = [];
    let online = false;
    const loop = createPushLoop({
      send: async (b) => {
        sent.push(b);
        if (!online) throw new Error('offline');
      },
      now: () => Date.now(),
      intervalMs: 1000,
    });
    loop.tap();
    await vi.advanceTimersByTimeAsync(4000);
    online = true;
    for (let i = 0; i < 50; i++) loop.tap();
    await vi.advanceTimersByTimeAsync(1000);
    const last = sent.at(-1)!;
    expect(last.ago.length).toBe(40);
    expect(Math.max(...last.ago)).toBeLessThanOrEqual(3000);
    loop.stop();
  });

  it('stop ends the sends', async () => {
    const send = vi.fn(async () => {});
    const loop = createPushLoop({ send, now: () => Date.now(), intervalMs: 1000 });
    loop.stop();
    await vi.advanceTimersByTimeAsync(3000);
    expect(send).not.toHaveBeenCalled();
  });
});
