import { sessionKeys } from '@chacota/live';

/** Runners of one round, spread over shards: each phone writes its own item about once a second. */
export const runnersPk = (sessionId: string, round: number, shard: number) => sessionKeys.module(sessionId, 'embolsau', 'R', round, shard);
export const runnerSk = (playerId: string) => `RUNNER#${playerId}`;

/** Places of a round, written by the presenter's tick; each push reads it to tell the phone its place. */
export const placesKey = (sessionId: string, round: number) => ({ pk: sessionKeys.module(sessionId, 'embolsau', 'PLACES'), sk: `ROUND#${round}` });

/** Per-round results kept for the history details. */
export const roundsPk = (sessionId: string) => sessionKeys.module(sessionId, 'embolsau', 'ROUNDS');
export const roundSk = (round: number) => `ROUND#${round}`;
