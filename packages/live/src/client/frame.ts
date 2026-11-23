import type { SessionStatus } from '../model';

export interface FrameStep {
  status: SessionStatus;
  /** Mount the activity screen afresh (and forget buffered events). */
  restart: boolean;
  /** Pass the event on to the activity screen. */
  deliver?: true;
}

/**
 * How the presenter and phone frames react to an event. "started" and the activity's first event
 * are separate publishes and may arrive in either order: whichever comes first starts the
 * activity, and a late "started" changes nothing.
 */
export function frameOnEvent(status: SessionStatus, type: string): FrameStep {
  if (type === 'ended') return { status: 'ended', restart: false };
  if (status === 'ended' || type === 'player_joined') return { status, restart: false };
  if (type === 'started') return { status: 'running', restart: status === 'lobby' };
  return status === 'lobby' ? { status: 'running', restart: true, deliver: true } : { status, restart: false, deliver: true };
}
