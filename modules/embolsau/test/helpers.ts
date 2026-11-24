import type { ActivityServer, LiveService, Session } from '@chacota/live';
import { embolsauManifest } from '../src/manifest';
import type { EmbolsauConfig, EmbolsauState, Phase } from '../src/model';

export const config: EmbolsauConfig = { meter: true, track: 'short', rounds: 2, maxPlayers: 100 };

/** Stand-in activity for tests of the participant side: state is written by hand. */
export const bareActivity: ActivityServer<EmbolsauConfig, EmbolsauState> = {
  manifest: embolsauManifest,
  prepare: (c) => ({ title: 'Embolsau', state: { config: c, phase: null, round: 0, phaseEndsAt: null, raceStartedAt: null } }),
  advance: async (_live, s) => s,
  snapshot: async () => ({}),
  results: async () => ({ columns: [], extra: {}, details: null }),
};

export async function setPhase(live: LiveService, id: string, phase: Phase, patch: Partial<EmbolsauState> = {}) {
  let session = (await live.getSession<EmbolsauState>(id))!;
  if (session.status === 'lobby') session = await live.transition(session, { status: 'running' });
  return live.transition(session, { state: { ...session.state, phase, ...patch } }) as Promise<Session<EmbolsauState>>;
}

export const never = () => 1;
