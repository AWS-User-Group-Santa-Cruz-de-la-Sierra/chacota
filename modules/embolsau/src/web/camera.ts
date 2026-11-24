import { laneOf, type StandingRunner } from '../model';
import { simulate } from '../physics';

/** Meters of track the presenter's screen shows at once (chosen with the mockups). */
export const VIEW_METERS = 75;

export type RunnerView = StandingRunner & { /** Server time of the standings this came from. */ at: number };

/** Left edge of the view: the leader at about 75 % of the width, the finish line in view at the end. */
export function cameraX(leaderMeters: number, trackMeters: number): number {
  return Math.max(0, Math.min(leaderMeters - VIEW_METERS * 0.75, trackMeters - VIEW_METERS * 0.85));
}

/** Runners who fell behind the left edge of the view. */
export function behindCount(runners: RunnerView[], camX: number): number {
  return runners.filter((r) => r.meters < camX).length;
}

/**
 * Where a runner probably is at `at`, from its last standings: the sack slows it down and nobody
 * taps in between. Smooths the animation between two updates (about 500 ms apart).
 */
export function interpolate(r: RunnerView, at: number, trackMeters: number): RunnerView {
  if (r.down || r.finished || at <= r.at) return r;
  const moved = simulate({ meters: r.meters, speed: r.speed, t: r.at, downUntil: 0, falls: 0, finishedAt: null }, [], at, trackMeters, () => 1);
  return { ...r, meters: moved.meters, speed: moved.speed };
}

export { laneOf };
