/** UI contract of an activity: the platform renders the frame, the activity renders the game. */
import type { ComponentType } from 'react';
import type { LiveEvent } from './model';

export interface HostScreenProps {
  sessionId: string;
  /** The activity part of the snapshot taken when the page loaded. */
  snapshot: Record<string, unknown>;
  serverNow: number;
  playerCount: number;
  subscribe(listener: (event: LiveEvent) => void): () => void;
  /** Moves the session forward (the same as the presenter's main button). */
  advance(): Promise<void>;
  hostAction(name: string, args?: unknown): Promise<unknown>;
  pending: boolean;
}

export interface PlayScreenProps {
  sessionId: string;
  playerId: string;
  token: string;
  apiUrl: string;
  snapshot: Record<string, unknown>;
  serverNow: number;
  subscribe(listener: (event: LiveEvent) => void): () => void;
  setScore(score: number): void;
}

export interface ActivityWeb {
  id: string;
  Icon: ComponentType<{ size?: number }>;
  Host: ComponentType<HostScreenProps>;
  Play?: ComponentType<PlayScreenProps>;
  ResultsDetails?: ComponentType<{ details: unknown }>;
}
