import { LiveError } from '@chacota/live';
import { z } from 'zod';
import { MAX_NAMES, MAX_OVERBOARD, MIN_NAMES, NAME_MAX, type RifaConfig } from '../model';

const Config = z.object({
  mode: z.enum(['list', 'qr']),
  overboard: z.number().int().min(0).max(MAX_OVERBOARD),
  names: z.array(z.string().trim().min(1).max(NAME_MAX)).min(MIN_NAMES).max(MAX_NAMES).optional(),
  title: z.string().max(80).optional(),
});

export function parseConfig(input: unknown): RifaConfig {
  const parsed = Config.safeParse(input);
  if (!parsed.success) throw new LiveError('not_playable');
  const { mode, overboard, names, title } = parsed.data;
  if (mode === 'list' && !names) throw new LiveError('not_playable');
  return { mode, overboard, ...(mode === 'list' ? { names } : {}), ...(title !== undefined ? { title } : {}) };
}
