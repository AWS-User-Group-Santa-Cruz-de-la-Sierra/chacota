import type { Clock } from '@chacota/live/web';
import { useEffect, useReducer } from 'react';
import type { Round } from '../model';
import { nextBoundary } from '../timeline';

/**
 * Re-renders the screen when a step of the round starts or is revealed, and when the round ends,
 * so whatever reads the clock (the bag, the winners, the phone's flood) changes right on time.
 * `enabled` holds it until the screen may read the clock.
 */
export function useRoundTicker(round: Round | null, clock: Clock, enabled = true): void {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // After every render: a new round, a clock resync or any other change re-arms it.
  useEffect(() => {
    if (!enabled) return;
    const at = clock.now();
    const next = nextBoundary(round, at);
    if (next === undefined) return;
    // A little past the boundary, so the render lands inside the new step.
    const timer = setTimeout(rerender, next - at + 20);
    return () => clearTimeout(timer);
  });
}
