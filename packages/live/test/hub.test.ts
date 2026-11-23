import { describe, expect, it } from 'vitest';
import { createEventHub } from '../src/client/hub';
import type { LiveEvent } from '../src/model';

const round = (n: number): LiveEvent => ({ type: 'echo.round', round: n });

describe('createEventHub', () => {
  it('replays events a late subscriber missed since the last reset', () => {
    const hub = createEventHub();
    hub.emit(round(1));
    const seen: LiveEvent[] = [];
    hub.subscribe((e) => seen.push(e));
    hub.emit(round(2));
    expect(seen).toEqual([round(1), round(2)]);
  });

  it('forgets the buffer on reset and stops delivering after unsubscribe', () => {
    const hub = createEventHub();
    hub.emit(round(1));
    hub.reset();
    const seen: LiveEvent[] = [];
    const off = hub.subscribe((e) => seen.push(e));
    hub.emit(round(2));
    off();
    hub.emit(round(3));
    expect(seen).toEqual([round(2)]);
  });
});
