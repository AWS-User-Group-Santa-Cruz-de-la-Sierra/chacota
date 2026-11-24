import { LiveError } from '@chacota/live';
import { z } from 'zod';
import { MAX_PLAYERS, TRACKS, type EmbolsauConfig } from '../model';

const Config = z.object({
  meter: z.boolean(),
  track: z.enum(TRACKS as [string, ...string[]]),
  rounds: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  maxPlayers: z.number().int().min(1).max(MAX_PLAYERS),
  title: z.string().max(80).optional(),
});

/** What the "Nueva carrera" form sends. The cap of 100 is enforced here, not only in the form. */
export function parseConfig(input: unknown): EmbolsauConfig {
  const parsed = Config.safeParse(input);
  if (!parsed.success) throw new LiveError('not_playable');
  return parsed.data as EmbolsauConfig;
}
