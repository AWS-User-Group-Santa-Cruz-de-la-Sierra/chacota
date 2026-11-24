import type { Animal, EmbolsauEvent, Phase, PlayerSnapshot, RoundRank, RunnerResult, Track } from '../model';

/** Everything the phone's race screen shows, built from its snapshot, the events and the push answers. */
export interface PhoneState {
  phase: Phase | null;
  round: number;
  rounds: number;
  phaseEndsAt: number | null;
  raceStartedAt: number | null;
  meter: boolean;
  track: Track | null;
  animal: Animal | null;
  /** False only when the server said this player joined after the start of the round. */
  inRound: boolean;
  result: RunnerResult | null;
  lastRank?: RoundRank;
  /** Server time until which the runner is down; 0 when it isn't. */
  downUntil: number;
}

export type PhoneAction =
  | { type: 'event'; event: EmbolsauEvent; playerId: string }
  | { type: 'push'; result: RunnerResult }
  | { type: 'picked'; animal: Animal }
  | { type: 'notInRound' };

/** The platform mounts the screen with an empty snapshot right after "started"; events fill it in. */
export function initialPhoneState(s: Partial<PlayerSnapshot>): PhoneState {
  return {
    phase: s.phase ?? null,
    round: s.round ?? 0,
    rounds: s.rounds ?? 1,
    phaseEndsAt: s.phaseEndsAt ?? null,
    raceStartedAt: s.raceStartedAt ?? null,
    meter: s.meter ?? false,
    track: s.track ?? null,
    animal: s.animal ?? s.runner?.animal ?? null,
    inRound: s.inRound ?? true,
    result: s.runner ?? null,
    lastRank: s.lastRank,
    downUntil: s.runner?.down ? s.runner.downUntil : 0,
  };
}

export function phoneReducer(state: PhoneState, action: PhoneAction): PhoneState {
  switch (action.type) {
    case 'event': {
      const e = action.event;
      if (e.type === 'embolsau.phase') {
        const next = { ...state, phase: e.phase, round: e.round, rounds: e.rounds, phaseEndsAt: e.phaseEndsAt, raceStartedAt: e.raceStartedAt, meter: e.meter, track: e.track };
        // A new round: everyone in the session runs it.
        return e.phase === 'countdown' ? { ...next, inRound: true, result: null, downUntil: 0 } : next;
      }
      if (e.type === 'embolsau.roundResults') return { ...state, lastRank: e.ranks[action.playerId] };
      return state;
    }
    case 'push':
      return { ...state, result: action.result, animal: action.result.animal, downUntil: Math.max(state.downUntil, action.result.downUntil) };
    case 'picked':
      return { ...state, animal: action.animal };
    case 'notInRound':
      return { ...state, inRound: false };
  }
}
