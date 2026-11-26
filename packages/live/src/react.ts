/** Client-side timing helpers shared by the platform frame and activity screens. */
import { useEffect, useState } from 'react';

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

export type ServerClock = ReturnType<typeof useServerClock>;

interface Measured {
  deadline: number;
  left: number;
}

/**
 * What `useCountdown` reports: the last measurement, only if it was taken for this same deadline.
 * A screen that stays mounted from one question to the next must not see the previous question's
 * "0 left" as the new one's: Tiluchi's presenter auto-reveals on 0, so it revealed every question
 * that followed one that ran out of time, the moment it appeared.
 */
export function countdownLeft(measured: Measured | null, deadline: number | undefined): number | null {
  return deadline !== undefined && measured?.deadline === deadline ? measured.left : null;
}

/**
 * Milliseconds left until `deadline` (server time), re-rendering a few times per second.
 * Null until measured for the current deadline: on mount (time depends on the client clock, so it
 * must not be server-rendered) and again each time the deadline changes.
 */
export function useCountdown(deadline: number | undefined, serverNow: () => number): number | null {
  const [measured, setMeasured] = useState<Measured | null>(null);
  useEffect(() => {
    if (deadline === undefined) return;
    const tick = () => setMeasured({ deadline, left: Math.max(0, deadline - serverNow()) });
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 200);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [deadline, serverNow]);
  return countdownLeft(measured, deadline);
}
