/**
 * Minimal AppSync Events WebSocket client (also spoken by the local broker).
 * Protocol: https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html
 * Browser-safe: no Node imports.
 */
import type { LiveEvent } from '../model';

export interface RealtimeConfig {
  /** Host used for authorization, e.g. xxx.appsync-api.us-east-1.amazonaws.com or localhost:4001 */
  httpDns: string;
  /** wss://xxx.appsync-realtime-api.us-east-1.amazonaws.com/event/realtime or ws://localhost:4001/event/realtime */
  realtimeUrl: string;
  apiKey?: string;
}

type Listener = (event: LiveEvent) => void;

export interface RealtimeConnection {
  subscribe(channel: string, listener: Listener): () => void;
  /** Called after the socket reconnects, so callers can resync missed state. */
  onReconnect(callback: () => void): void;
  close(): void;
}

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function connectRealtime(config: RealtimeConfig): RealtimeConnection {
  const authorization: Record<string, string> = { host: config.httpDns };
  if (config.apiKey) authorization['x-api-key'] = config.apiKey;

  const subscriptions = new Map<string, { channel: string; listener: Listener }>();
  const reconnectCallbacks: (() => void)[] = [];
  let socket: WebSocket | undefined;
  let ready = false;
  let closed = false;
  let attempts = 0;
  let keepAliveTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutMs = 300_000;

  const send = (message: object) => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify(message));
  const sendSubscribe = (id: string, channel: string) => send({ type: 'subscribe', id, channel, authorization });

  function armKeepAlive() {
    clearTimeout(keepAliveTimer);
    keepAliveTimer = setTimeout(() => socket?.close(), timeoutMs);
  }

  function open(isReconnect: boolean) {
    socket = new WebSocket(config.realtimeUrl, ['aws-appsync-event-ws', `header-${base64Url(JSON.stringify(authorization))}`]);
    socket.onopen = () => send({ type: 'connection_init' });
    socket.onmessage = (message) => {
      const data = JSON.parse(String(message.data)) as { type: string; id?: string; event?: string; connectionTimeoutMs?: number };
      armKeepAlive();
      switch (data.type) {
        case 'connection_ack':
          ready = true;
          attempts = 0;
          timeoutMs = data.connectionTimeoutMs ?? timeoutMs;
          for (const [id, s] of subscriptions) sendSubscribe(id, s.channel);
          if (isReconnect) reconnectCallbacks.forEach((cb) => cb());
          break;
        case 'data':
          if (data.id && data.event) subscriptions.get(data.id)?.listener(JSON.parse(data.event) as LiveEvent);
          break;
        case 'subscribe_error':
        case 'error':
          console.warn('[realtime]', data);
          break;
      }
    };
    socket.onclose = () => {
      ready = false;
      clearTimeout(keepAliveTimer);
      if (closed) return;
      // Exponential backoff with jitter, capped at 10s.
      const delay = Math.min(10_000, 500 * 2 ** attempts++) * (0.5 + Math.random() / 2);
      setTimeout(() => open(true), delay);
    };
  }

  open(false);

  return {
    subscribe(channel, listener) {
      const id = crypto.randomUUID();
      subscriptions.set(id, { channel, listener });
      if (ready) sendSubscribe(id, channel);
      return () => {
        subscriptions.delete(id);
        if (ready) send({ type: 'unsubscribe', id });
      };
    },
    onReconnect(callback) {
      reconnectCallbacks.push(callback);
    },
    close() {
      closed = true;
      clearTimeout(keepAliveTimer);
      socket?.close();
    },
  };
}

export type { LiveEvent, ModuleEvent, PlatformEvent, RankEntry, ResultColumn, ResultEntry, SessionStatus, Standing } from '../model';
export { channels, NICKNAME_MAX, playerCode } from '../model';
export { createEventHub, type EventHub } from './hub';
export { frameOnEvent, type FrameStep } from './frame';
