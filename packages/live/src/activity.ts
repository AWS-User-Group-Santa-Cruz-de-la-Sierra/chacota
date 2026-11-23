import type { ActivityManifest } from '@chacota/core';
import type { Hono } from 'hono';
import type { ModuleResults, Player, Session } from './model';
import type { LiveService } from './service';

/**
 * Server side of an activity. The platform owns PINs, players, presenter transitions, realtime
 * delivery and results storage; the activity owns what happens while the session runs.
 */
export interface ActivityServer<TContent = unknown, TState = unknown> {
  manifest: ActivityManifest;
  /** Validates the content a host starts with and builds the initial state. Throws LiveError('not_playable'). */
  prepare(content: TContent): { title: string; state: TState };
  /** The presenter moves forward while the session runs. Use live.transition/publish, or live.end when done. */
  advance(live: LiveService, session: Session<TState>): Promise<Session<TState>>;
  /** What a reconnecting client needs (the presenter when playerId is undefined). */
  snapshot(live: LiveService, session: Session<TState>, playerId?: string): Promise<Record<string, unknown>>;
  /** Extra result columns and details, computed once when the session ends. */
  results(live: LiveService, session: Session<TState>, players: Player[]): Promise<ModuleResults>;
  /** Presenter actions besides advancing (Tiluchi: count answers). */
  hostActions?: Record<string, (live: LiveService, session: Session<TState>, args: unknown) => Promise<unknown>>;
  /** Participant routes, mounted at /m/<id>. */
  routes?(app: Hono, live: LiveService): void;
}

// The registry holds activities with different content and state types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyActivityServer = ActivityServer<any, any>;
