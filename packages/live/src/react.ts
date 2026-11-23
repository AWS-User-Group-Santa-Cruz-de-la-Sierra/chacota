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
