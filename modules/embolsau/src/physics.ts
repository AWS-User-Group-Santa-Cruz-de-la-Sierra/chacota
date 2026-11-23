/**
 * The race physics. Pure: the server runs it to decide (with a secure random source) and the
 * phone runs it with `rng = () => 1` (never trips) only to draw the speed meter.
 * Units: meters, meters per second, milliseconds of server time.
 */
export const PHYSICS = {
  stepMs: 50,
  /** Speed added by each tap (m/s). */
  tapBoost: 2,
  /** The sack slows you down: speed *= exp(-drag · seconds). */
  drag: 1.5,
  /** Up to this speed there is no risk (green). */
  safeSpeed: 8,
  /** From this speed on the risk is high (red); between both, yellow. */
  redSpeed: 10,
  /** Trips per second = tripK · (speed − safeSpeed)². */
  tripK: 0.08,
  fallMs: 1200,
  fallJitterMs: 600,
  maxTapsPerSec: 12,
} as const;

export interface Runner {
  meters: number;
  speed: number;
  /** Server time up to which the runner has been simulated. */
  t: number;
  /** Down (fallen) until this time. */
  downUntil: number;
  falls: number;
  /** Server time it crossed the line, or null. */
  finishedAt: number | null;
}

export function startRunner(t: number): Runner {
  return { meters: 0, speed: 0, t, downUntil: 0, falls: 0, finishedAt: null };
}

export type Zone = 'green' | 'yellow' | 'red';

export function zone(speed: number): Zone {
  if (speed <= PHYSICS.safeSpeed) return 'green';
  return speed < PHYSICS.redSpeed ? 'yellow' : 'red';
}

export function tripRatePerSec(speed: number): number {
  const over = speed - PHYSICS.safeSpeed;
  return over > 0 ? PHYSICS.tripK * over * over : 0;
}

/** Sorted taps, without those past `maxPerSec` in any 1000 ms window (a script tapping 50/s gains nothing). */
export function limitTaps(taps: number[], maxPerSec: number): number[] {
  const sorted = [...taps].sort((a, b) => a - b);
  const kept: number[] = [];
  for (const tap of sorted) {
    let inWindow = 0;
    for (let i = kept.length - 1; i >= 0 && kept[i]! > tap - 1000; i--) inWindow++;
    if (inWindow < maxPerSec) kept.push(tap);
  }
  return kept;
}

/**
 * Advances the runner from `r.t` to `until`, applying `taps` (server times, sorted) in fixed steps.
 * Taps before `r.t` are applied in the first step.
 */
export function simulate(r: Runner, taps: number[], until: number, trackMeters: number, rng: () => number): Runner {
  const next: Runner = { ...r };
  if (next.finishedAt !== null || until <= next.t) return { ...next, t: Math.max(next.t, until) };
  let i = 0;
  while (next.t < until) {
    const end = Math.min(next.t + PHYSICS.stepMs, until);
    const dt = (end - next.t) / 1000;
    let boost = 0;
    while (i < taps.length && taps[i]! < end) {
      boost += PHYSICS.tapBoost;
      i++;
    }
    if (next.t < next.downUntil) {
      next.speed = 0;
    } else {
      next.speed = (next.speed + boost) * Math.exp(-PHYSICS.drag * dt);
      const rate = tripRatePerSec(next.speed);
      if (rate > 0 && rng() < rate * dt) {
        next.downUntil = next.t + PHYSICS.fallMs + rng() * PHYSICS.fallJitterMs;
        next.falls++;
        next.speed = 0;
      }
    }
    const meters = next.meters + next.speed * dt;
    if (meters >= trackMeters) {
      const fraction = next.speed > 0 ? (trackMeters - next.meters) / (next.speed * dt) : 1;
      next.finishedAt = next.t + fraction * (end - next.t);
      next.meters = trackMeters;
      next.speed = 0;
      next.t = until;
      return next;
    }
    next.meters = meters;
    next.t = end;
  }
  return next;
}
