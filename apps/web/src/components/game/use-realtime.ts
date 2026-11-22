'use client';

import { connectRealtime, type GameEvent, type RealtimeConfig } from '@chacota/game/client';
import { useEffect, useRef, useState } from 'react';

/**
 * Subscribes to the given channels while mounted. `onEvent` and `onReconnect` may change
 * between renders without resubscribing.
 */
export function useRealtime(
  config: RealtimeConfig,
  channels: string[],
  onEvent: (event: GameEvent) => void,
  onReconnect?: () => void,
) {
  const handlers = useRef({ onEvent, onReconnect });
  useEffect(() => {
    handlers.current = { onEvent, onReconnect };
  });
  const [connected, setConnected] = useState(true);
  const key = channels.join('|');

  useEffect(() => {
    if (!key) return;
    const connection = connectRealtime(config);
    const unsubscribers = key.split('|').map((channel) => connection.subscribe(channel, (e) => handlers.current.onEvent(e)));
    connection.onReconnect(() => {
      setConnected(true);
      handlers.current.onReconnect?.();
    });
    const onOffline = () => setConnected(false);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('offline', onOffline);
      unsubscribers.forEach((u) => u());
      connection.close();
    };
    // config is stable for the lifetime of the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { connected };
}

/** Estimates `server time - local time` from timestamps the server sends. */
export function useServerClock() {
  // Stable identity so effects depending on `now` don't restart on every render.
  const [clock] = useState(() => {
    let offset = 0;
    return {
      sync(serverNow: number) {
        offset = serverNow - Date.now();
      },
      now() {
        return Date.now() + offset;
      },
    };
  });
  return clock;
}

/**
 * Milliseconds left until `deadline` (server time), re-rendering a few times per second.
 * Returns null until mounted: time depends on the client clock, so it must not be server-rendered.
 */
export function useCountdown(deadline: number | undefined, serverNow: () => number): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === undefined) return;
    const tick = () => setLeft(Math.max(0, deadline - serverNow()));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 200);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [deadline, serverNow]);
  return deadline === undefined ? null : left;
}
