/**
 * UI contract of an activity. The platform renders the frame (lobby with PIN and QR, joining,
 * reconnection, podium, verification code); the activity renders what happens while it runs.
 */
import type { ComponentType, ReactNode } from 'react';
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
  /** Disables the main button, and the keyboard and clicker shortcuts, while the activity is busy (e.g. an animation). Also blocks the activity's own `advance()` calls. */
  setAdvanceDisabled(disabled: boolean): void;
  /** Short progress text shown next to the title in the header (e.g. "Question 2 of 10"), or null. */
  setSubtitle(text: string | null): void;
  /** Something small shown in the footer, between the keyboard hint and the buttons (e.g. a race's minimap), or null. */
  setFooter(node: ReactNode | null): void;
  /** Runs an activity's host action. A result with a numeric `version` keeps the main button in sync with phases the action moved. */
  hostAction(name: string, args?: unknown): Promise<unknown>;
  /** Shows an image (S3 key) behind the whole presenter screen, under a dark veil; null removes it. */
  setBackground(key: string | null): void;
  /** Public URL of an S3 key, to show the activity's own images. */
  mediaUrl(key: string): string;
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
  /** Short summary under the title in the lobby (e.g. "12 questions · about 8 minutes"). */
  LobbySummary?: ComponentType<{ snapshot: Record<string, unknown> }>;
  /** Replaces the podium on the presenter's screen once the session ended. */
  Final?: ComponentType<{ snapshot: Record<string, unknown> }>;
  /** Replaces the "you finished Nth" line on the phone; the verification code stays. */
  PlayFinal?: ComponentType<{ snapshot: Record<string, unknown>; playerId: string }>;
}
