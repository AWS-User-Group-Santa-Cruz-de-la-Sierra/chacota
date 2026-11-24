/**
 * The race physics. Pure: the server runs it to decide (with a secure random source) and the
 * phone runs it with `rng = () => 1` (never trips) only to draw the speed meter.
 * Units: meters, meters per second, milliseconds of server time.
 */
export const PHYSICS = {
  stepMs: 50,
  /** Speed added by each tap (m/s): about 4 taps/s cruise in green, 5–6 in yellow, 7–8 in red. */
  tapBoost: 2.9,
  /** The sack slows you down: speed *= exp(-drag · seconds). */
  drag: 1.5,
  /** Up to this speed there is no risk (green). */
  safeSpeed: 8,
  /** From this speed on the risk is high (red); between both, yellow. */
  redSpeed: 13,
  /**
   * Trips per second in each zone (chance within one second = 1 − e^(−rate)), agreed with the
   * maintainer after simulating 2000 races per pace: green ≈ 2 % once moving (safe and slow);
   * yellow 4 % → 17 % (steady); red a flat 22 % with a turbo and a long fall (the gamble: the
   * fastest race when it goes well, the slowest when it doesn't).
   */
  greenRate: 0.0202,
  /** Below this speed (m/s) nobody trips: standing still or barely moving. */
  movingSpeed: 1,
  yellowBase: 0.04,
  yellowSlope: 0.03,
  redRate: 0.25,
  /** In red, each tap pushes this much more. */
  redTurbo: 1.3,
  /** A fall in green or yellow: 1–1.4 s on the ground. */
  fallMs: 1000,
  fallJitterMs: 400,
  /** A fall in red: 2.5–3.5 s. */
  redFallMs: 2500,
  redFallJitterMs: 1000,
  /** Taps per second that count in full; each one past it is worth half the previous one. */
  fullTapsPerSec: 8,
  /** Hard limit against scripts: taps past this in any second are dropped. */
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
  /** Taps of the last second (server times), for the decreasing returns past 8 taps/s. */
  recent?: number[];
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
  if (speed < PHYSICS.movingSpeed) return 0;
  if (speed <= PHYSICS.safeSpeed) return PHYSICS.greenRate;
  if (speed < PHYSICS.redSpeed) return PHYSICS.yellowBase + PHYSICS.yellowSlope * (speed - PHYSICS.safeSpeed);
  return PHYSICS.redRate;
}

/** What `n` taps within one second are worth: in full up to 8, then each extra one half the previous. */
export function effectiveTaps(n: number): number {
  const full = PHYSICS.fullTapsPerSec;
  return n <= full ? n : full + (1 - 0.5 ** (n - full));
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
  let recent = [...(r.recent ?? [])];
  while (next.t < until) {
    const end = Math.min(next.t + PHYSICS.stepMs, until);
    const dt = (end - next.t) / 1000;
    let boost = 0;
    const turbo = next.speed >= PHYSICS.redSpeed ? PHYSICS.redTurbo : 1;
    while (i < taps.length && taps[i]! < end) {
      const tap = taps[i]!;
      recent = recent.filter((x) => x > tap - 1000);
      recent.push(tap);
      // Past 8 taps/s every tap of that second is worth a bit less, so the extra ones add little.
      boost += PHYSICS.tapBoost * turbo * (effectiveTaps(recent.length) / recent.length);
      i++;
    }
    if (next.t < next.downUntil) {
      next.speed = 0;
    } else {
      next.speed = (next.speed + boost) * Math.exp(-PHYSICS.drag * dt);
      const rate = tripRatePerSec(next.speed);
      if (rate > 0 && rng() < rate * dt) {
        const red = next.speed >= PHYSICS.redSpeed;
        next.downUntil = next.t + (red ? PHYSICS.redFallMs + rng() * PHYSICS.redFallJitterMs : PHYSICS.fallMs + rng() * PHYSICS.fallJitterMs);
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
      next.recent = recent;
      return next;
    }
    next.meters = meters;
    next.t = end;
  }
  next.recent = recent.filter((x) => x > until - 1000);
  return next;
}
