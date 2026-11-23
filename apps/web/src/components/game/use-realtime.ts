'use client';

import { connectRealtime, type LiveEvent, type RealtimeConfig } from '@chacota/live/client';
import { useEffect, useRef, useState } from 'react';

/**
 * Subscribes to the given channels while mounted. `onEvent` and `onReconnect` may change
 * between renders without resubscribing.
 */
export function useRealtime(
  config: RealtimeConfig,
  channels: string[],
  onEvent: (event: LiveEvent) => void,
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
