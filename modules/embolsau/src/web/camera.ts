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

/**
 * Where each runner is at `at`, gliding evenly between the two latest updates. The screen draws a
 * little in the past (RENDER_DELAY_MS) so `at` normally falls between them: no guessing, no jumps.
 * If an update is late, it carries on from the latest one.
 */
export function between(prev: RunnerView[], next: RunnerView[], at: number, trackMeters: number): RunnerView[] {
  const before = new Map(prev.map((r) => [r.id, r]));
  return next.map((r) => {
    const p = before.get(r.id);
    if (!p || at >= r.at || r.at <= p.at) return interpolate(r, at, trackMeters);
    if (at <= p.at) return { ...r, meters: p.meters, speed: p.speed, down: p.down };
    const k = (at - p.at) / (r.at - p.at);
    return { ...r, meters: p.meters + (r.meters - p.meters) * k, speed: p.speed + (r.speed - p.speed) * k, down: k < 0.5 ? p.down : r.down };
  });
}

/** One standings update as the screen keeps it. */
export interface Snapshot {
  at: number;
  runners: RunnerView[];
}

/** How many updates the screen keeps: enough to always have the segment it is drawing. */
export const HISTORY = 4;

/**
 * The runners at `at`, from a short history of updates (oldest first): interpolates inside the
 * segment that contains `at`, carries on past the latest one, and shows the oldest before it starts.
 */
export function sampleAt(history: Snapshot[], at: number, trackMeters: number): RunnerView[] {
  if (history.length === 0) return [];
  let i = history.length - 1;
  while (i > 0 && history[i]!.at > at) i--;
  if (i === history.length - 1) return between(history[i - 1]?.runners ?? [], history[i]!.runners, at, trackMeters);
  return between(history[i]!.runners, history[i + 1]!.runners, at, trackMeters);
}

/** How far behind real time the race is drawn: a bit more than the 500 ms between updates. */
export const RENDER_DELAY_MS = 600;

/** The camera follows its target smoothly instead of jerking with every update (dt in ms). */
export function smoothCamera(current: number, target: number, dtMs: number): number {
  return current + (target - current) * (1 - Math.exp(-dtMs / 180));
}

export { laneOf };
