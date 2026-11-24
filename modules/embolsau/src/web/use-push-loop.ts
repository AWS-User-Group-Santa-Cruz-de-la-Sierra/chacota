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
 * the phone's place). One send at a time.
 * - `seq` comes from the clock, so it keeps growing when the screen remounts (a reconnect) and the
 *   server never takes the new batches for old ones.
 * - A failed batch is resent as is, with the same seq: if the first try did reach the server, the
 *   retry is ignored instead of counting the taps twice. Newer taps wait for the next batch.
 */
export function createPushLoop({ send, now, intervalMs = 1000 }: { send: (batch: PushBatch) => Promise<void>; now: () => number; intervalMs?: number }) {
  let pending: number[] = [];
  let retry: { seq: number; taps: number[] } | null = null;
  let inFlight = false;
  let lastSeq = 0;
  let stopped = false;

  async function flush() {
    if (inFlight || stopped) return;
    const at = now();
    // A retry whose taps are all too old for the server is not worth sending again.
    if (retry && retry.taps.every((t) => at - t > MAX_AGO_MS)) retry = null;
    let batch = retry;
    if (!batch) {
      lastSeq = Math.max(lastSeq + 1, Math.floor(at));
      batch = { seq: lastSeq, taps: pending.slice(-MAX_TAPS) };
      pending = [];
    }
    inFlight = true;
    try {
      await send({ seq: batch.seq, ago: batch.taps.map((t) => Math.max(0, Math.round(at - t))).filter((a) => a <= MAX_AGO_MS) });
      retry = null;
    } catch {
      retry = batch;
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
