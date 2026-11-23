import type { LiveEvent } from '../model';

export interface EventHub {
  emit(event: LiveEvent): void;
  /** Replays what was emitted since the last reset, then delivers new events. */
  subscribe(listener: (event: LiveEvent) => void): () => void;
  /** Forgets buffered events (call when the screen is rebuilt from a fresh snapshot). */
  reset(): void;
}

/**
 * Fans realtime events out to the activity screen. The activity mounts after the platform sees
 * "started", and its first event can arrive before it subscribes: the buffer covers that gap.
 */
export function createEventHub(): EventHub {
  let buffer: LiveEvent[] = [];
  const listeners = new Set<(event: LiveEvent) => void>();
  return {
    emit(event) {
      buffer.push(event);
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      for (const event of buffer) listener(event);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      buffer = [];
    },
  };
}
