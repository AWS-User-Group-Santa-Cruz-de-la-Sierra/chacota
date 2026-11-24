import { useEffect, useRef } from 'react';

export interface PushBatch {
  seq: number;
  /** For each tap, how many milliseconds before sending it happened. */
  ago: number[];
}

/** What the server accepts in one batch (see the /push route). */
const MAX_AGO_MS = 3000;
const MAX_TAPS = 40;

/**
 * Collects taps and sends them about once a second, even when there are none (the answer carries
 * the phone's place). One send at a time; taps of a failed send go out with the next one.
 */
export function createPushLoop({ send, now, intervalMs = 1000 }: { send: (batch: PushBatch) => Promise<void>; now: () => number; intervalMs?: number }) {
  let pending: number[] = [];
  let inFlight = false;
  let seq = 0;
  let stopped = false;

  async function flush() {
    if (inFlight || stopped) return;
    const at = now();
    const batch = pending.filter((t) => at - t <= MAX_AGO_MS).slice(-MAX_TAPS);
    pending = [];
    inFlight = true;
    seq++;
    try {
      await send({ seq, ago: batch.map((t) => Math.max(0, Math.round(at - t))) });
    } catch {
      pending = [...batch, ...pending];
    } finally {
      inFlight = false;
    }
  }

  const timer = setInterval(flush, intervalMs);
  return {
    tap() {
      pending.push(now());
    },
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

/** The push loop for the lifetime of a race screen. */
export function usePushLoop(active: boolean, send: (batch: PushBatch) => Promise<void>, now: () => number) {
  const loop = useRef<ReturnType<typeof createPushLoop> | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!active) return;
    loop.current = createPushLoop({ send: (b) => sendRef.current(b), now });
    return () => {
      loop.current?.stop();
      loop.current = null;
    };
  }, [active, now]);
  return () => loop.current?.tap();
}
