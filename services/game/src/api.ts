import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { NICKNAME_MAX } from './model';
import { GameError, gameSnapshot, type GameService } from './service';

const STATUS: Record<GameError['code'], 400 | 401 | 404 | 409> = {
  game_not_found: 404,
  game_ended: 409,
  nickname_taken: 409,
  invalid_nickname: 400,
  invalid_token: 401,
  not_accepting_answers: 409,
  wrong_question: 409,
  already_answered: 409,
  invalid_answer: 400,
  invalid_transition: 409,
  not_playable: 400,
};

const JoinBody = z.object({ pin: z.string().regex(/^\d{6}$/), nickname: z.string().min(1).max(NICKNAME_MAX * 2) });
const AnswerBody = z.object({ questionIndex: z.number().int().min(0), value: z.string().min(1).max(64) });

/** Public API for participants. Hosts act through the web app's server actions. */
export function createApi(getService: () => Promise<GameService>, allowedOrigins: string[]) {
  const app = new Hono();
  app.use('*', cors({ origin: allowedOrigins, allowMethods: ['GET', 'POST'], allowHeaders: ['content-type', 'authorization'] }));

  app.onError((error, c) => {
    if (error instanceof GameError) return c.json({ error: error.code }, STATUS[error.code]);
    if (error instanceof z.ZodError) return c.json({ error: 'bad_request' }, 400);
    console.error(error);
    return c.json({ error: 'internal' }, 500);
  });

  const bearer = (header: string | undefined) => {
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new GameError('invalid_token');
    return token;
  };

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/join', async (c) => {
    const { pin, nickname } = JoinBody.parse(await c.req.json());
    const service = await getService();
    const { token, player, gameId } = await service.join(pin, nickname);
    return c.json({ token, gameId, playerId: player.id, nickname: player.nickname });
  });

  app.post('/answer', async (c) => {
    const token = bearer(c.req.header('authorization'));
    const body = AnswerBody.parse(await c.req.json());
    const service = await getService();
    return c.json(await service.answer(token, body));
  });

  app.get('/state', async (c) => {
    const service = await getService();
    const { gameId, playerId } = service.verifyToken(bearer(c.req.header('authorization')));
    const game = await service.getGame(gameId);
    if (!game) throw new GameError('game_not_found');
    return c.json(await gameSnapshot(service, game, playerId));
  });

  return app;
}
