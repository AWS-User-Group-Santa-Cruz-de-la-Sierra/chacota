import { SCENE_MS, type OutStep, type Round } from './model';

export type Step =
  | { kind: 'waiting'; inMs: number }
  | { kind: 'out'; index: number; elapsed: number }
  | { kind: 'winner'; elapsed: number }
  | { kind: 'done' };

export function stepAt(round: Round, now: number): Step {
  if (now >= round.endsAt) return { kind: 'done' };
  const first = round.out[0]?.startsAt ?? round.winner.startsAt;
  if (now < first) return { kind: 'waiting', inMs: first - now };
  if (now >= round.winner.startsAt) return { kind: 'winner', elapsed: now - round.winner.startsAt };
  for (let i = round.out.length - 1; i >= 0; i--) {
    if (now >= round.out[i]!.startsAt) return { kind: 'out', index: i, elapsed: now - round.out[i]!.startsAt };
  }
  return { kind: 'waiting', inMs: first - now };
}

/**
 * When an "al agua" step is revealed: the end of its scene. Until then nothing may show that this
 * entry went overboard (the bag on the big screen, the phone's flood).
 */
export function revealOf(step: OutStep): number {
  return step.startsAt + SCENE_MS[step.scene];
}

/** The next moment a screen changes during a round (a step starts or is revealed, or the round ends). */
export function nextBoundary(round: Round | null, now: number): number | undefined {
  if (!round) return undefined;
  const times = [...round.out.flatMap((o) => [o.startsAt, revealOf(o)]), round.winner.startsAt, round.endsAt].filter((t) => t > now);
  return times.length > 0 ? Math.min(...times) : undefined;
}
