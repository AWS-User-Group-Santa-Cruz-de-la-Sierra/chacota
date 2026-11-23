/**
 * UI contract of an activity. The platform renders the frame (lobby with PIN and QR, joining,
 * reconnection, podium, verification code); the activity renders what happens while it runs.
 */
import type { ComponentType } from 'react';
import type { LiveEvent } from './model';

export interface Clock {
  /** Current server time in milliseconds. */
  now(): number;
}

export interface HostScreenProps {
  sessionId: string;
  /** The activity part of the snapshot the screen starts from. */
  snapshot: Record<string, unknown>;
  clock: Clock;
  playerCount: number;
  /** Events since the snapshot, then live ones. Returns an unsubscribe function. */
  subscribe(listener: (event: LiveEvent) => void): () => void;
  /** Moves the session forward, the same as the presenter's main button and clicker. */
  advance(): void;
  /** Label of the presenter's main button for the current step. */
  setAdvanceLabel(label: string): void;
  hostAction(name: string, args?: unknown): Promise<unknown>;
}

export interface PlayScreenProps {
  sessionId: string;
  playerId: string;
  token: string;
  /** Participant API base URL; the activity's routes are under `${apiUrl}/m/<id>`. */
  apiUrl: string;
  snapshot: Record<string, unknown>;
  clock: Clock;
  subscribe(listener: (event: LiveEvent) => void): () => void;
  /** Updates the score shown in the phone's header. */
  setScore(score: number): void;
}

export interface ActivityWeb {
  id: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  Host: ComponentType<HostScreenProps>;
  Play?: ComponentType<PlayScreenProps>;
  ResultsDetails?: ComponentType<{ details: unknown }>;
}
