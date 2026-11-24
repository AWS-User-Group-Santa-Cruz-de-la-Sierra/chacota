import type { Player } from '@chacota/live';
import type { RoundPlace } from '../model';
import { simulate } from '../physics';
import type { StoredRunner } from './runners';

export type { RoundPlace };

export interface RoundClock {
  raceStartedAt: number;
  /** When the round stopped (server time). */
  closedAt: number;
  trackMeters: number;
}

/**
 * Points of a round: 1000 to the winner; 300–1000 for the other finishers by how far behind the
 * winner they crossed (until the round closed); 0–299 by meters for those who didn't finish.
 */
export function pointsFor(
  p: { timeMs: number | null; meters: number },
  round: { winnerMs: number | null; closedAtMs: number; trackMeters: number },
): number {
  if (p.timeMs === null || round.winnerMs === null) {
    return Math.min(299, Math.round((300 * Math.min(p.meters, round.trackMeters)) / round.trackMeters));
  }
  if (p.timeMs <= round.winnerMs) return 1000;
  const span = Math.max(1, round.closedAtMs - round.winnerMs);
  const behind = Math.min(1, Math.max(0, (p.timeMs - round.winnerMs) / span));
  return Math.round(300 + 700 * (1 - behind));
}

/** Just short of the line: where an estimate stops until the runner's own push confirms the finish. */
const BEFORE_LINE = 0.01;

/**
 * Where each runner probably is at `at`, coasting without new taps. Only an estimate: falls are not
 * drawn here, so it never decides a finish. A runner crosses the line only when its own push,
 * simulated with its real taps and falls, says so.
 */
export function project(runner: StoredRunner, at: number, trackMeters: number): StoredRunner {
  if (runner.finishedAt !== null) return runner;
  const coasted = simulate(runner, [], at, Number.POSITIVE_INFINITY, () => 1);
  return { ...runner, ...coasted, meters: Math.min(coasted.meters, trackMeters - BEFORE_LINE), finishedAt: null };
}

/** Finishers by time, then the rest by meters, then the eligible players who never pushed. */
export function sortRunners(runners: StoredRunner[]): StoredRunner[] {
  return [...runners].sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
    if (a.finishedAt !== null) return -1;
    if (b.finishedAt !== null) return 1;
    return b.meters - a.meters || a.nickname.localeCompare(b.nickname);
  });
}

/** The final order and points of a round. Only players in the round from the start are ranked. */
export function rankRound(runners: StoredRunner[], eligible: Player[], clock: RoundClock): RoundPlace[] {
  const inRound = new Set(eligible.map((p) => p.id));
  const projected = sortRunners(runners.filter((r) => inRound.has(r.playerId)).map((r) => project(r, clock.closedAt, clock.trackMeters)));
  const ran = new Set(projected.map((r) => r.playerId));
  const idle = eligible
    .filter((p) => !ran.has(p.id))
    .sort((a, b) => a.nickname.localeCompare(b.nickname))
    .map((p) => ({ playerId: p.id, nickname: p.nickname, meters: 0, finishedAt: null }));
  const ordered = [...projected, ...idle];
  const winner = projected[0]?.finishedAt ?? null;
  const round = {
    winnerMs: winner === null ? null : winner - clock.raceStartedAt,
    closedAtMs: clock.closedAt - clock.raceStartedAt,
    trackMeters: clock.trackMeters,
  };
  return ordered.map((r, i) => {
    const timeMs = r.finishedAt === null ? null : r.finishedAt - clock.raceStartedAt;
    return { playerId: r.playerId, nickname: r.nickname, place: i + 1, meters: r.meters, timeMs, points: pointsFor({ timeMs, meters: r.meters }, round) };
  });
}
