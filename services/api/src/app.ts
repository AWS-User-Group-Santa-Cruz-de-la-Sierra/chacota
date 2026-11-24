import { LiveError, NICKNAME_MAX, type AnyActivityServer, type LiveErrorCode, type LiveService } from '@chacota/live';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

const STATUS: Record<LiveErrorCode, 400 | 401 | 403 | 404 | 409> = {
  session_not_found: 404,
  session_ended: 409,
  nickname_taken: 409,
  session_full: 409,
  invalid_nickname: 400,
  invalid_token: 401,
  invalid_transition: 409,
  not_playable: 400,
  unknown_activity: 404,
  unknown_action: 404,
  activity_disabled: 403,
};

const JoinBody = z.object({ pin: z.string().regex(/^\d{6}$/), nickname: z.string().min(1).max(NICKNAME_MAX * 2) });

const bearer = (header: string | undefined) => {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) throw new LiveError('invalid_token');
  return token;
};

/** Public API for participants: platform routes plus each activity's routes under /m/<id>. */
export function createApi(getLive: () => Promise<LiveService>, activities: AnyActivityServer[], allowedOrigins: string[]) {
  const app = new Hono();
  app.use('*', cors({ origin: allowedOrigins, allowMethods: ['GET', 'POST'], allowHeaders: ['content-type', 'authorization'] }));

  app.onError((error, c) => {
    if (error instanceof LiveError) return c.json({ error: error.code }, STATUS[error.code]);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return c.json({ error: 'bad_request' }, 400);
    console.error(error);
    return c.json({ error: 'internal' }, 500);
  });

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/join', async (c) => {
    const { pin, nickname } = JoinBody.parse(await c.req.json());
    const { token, player, sessionId, module } = await (await getLive()).join(pin, nickname);
    return c.json({ token, sessionId, module, playerId: player.id, nickname: player.nickname });
  });

  app.get('/state', async (c) => {
    const live = await getLive();
    const { sessionId, playerId } = live.verifyToken(bearer(c.req.header('authorization')));
    return c.json(await live.snapshot(sessionId, playerId));
  });

  for (const activity of activities) {
    if (!activity.routes) continue;
    const routes = new Hono();
    activity.routes(routes, getLive);
    app.route(`/m/${activity.manifest.id}`, routes);
  }

  return app;
}
