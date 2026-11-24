import type { Round } from './model';

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
