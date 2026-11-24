import { LiveError, type LiveService } from '@chacota/live';
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { ANIMALS } from '../model';
import { EmbolsauError, pick, push, type EmbolsauErrorCode } from './runners';

const STATUS: Record<EmbolsauErrorCode, 400 | 409> = {
  not_picking: 409,
  not_racing: 409,
  not_in_round: 409,
  invalid_input: 400,
};

const PickBody = z.object({ animal: z.enum(ANIMALS) });
const PushBody = z.object({ seq: z.number().int().min(0), ago: z.array(z.number().min(0).max(3000)).max(40) });

const bearer = (header: string | undefined) => {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) throw new LiveError('invalid_token');
  return token;
};

/** Participant routes, mounted by the platform at /m/embolsau. */
export function embolsauRoutes(app: Hono, getLive: () => Promise<LiveService>) {
  const handle = <T>(schema: z.ZodType<T>, run: (live: LiveService, token: string, body: T) => Promise<unknown>) =>
    async (c: Context) => {
      const token = bearer(c.req.header('authorization'));
      const parsed = schema.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
      try {
        return c.json(await run(await getLive(), token, parsed.data));
      } catch (error) {
        if (error instanceof EmbolsauError) return c.json({ error: error.code }, STATUS[error.code]);
        throw error;
      }
    };
  app.post('/pick', handle(PickBody, (live, token, body) => pick(live, token, body.animal)));
  app.post('/push', handle(PushBody, (live, token, body) => push(live, token, body)));
}
