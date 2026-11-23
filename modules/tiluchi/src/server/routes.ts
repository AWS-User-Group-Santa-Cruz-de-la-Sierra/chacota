import type { LiveService } from '@chacota/live';
import { LiveError } from '@chacota/live';
import type { Hono } from 'hono';
import { z } from 'zod';
import { answer, TiluchiError, type TiluchiErrorCode } from './answer';

const STATUS: Record<TiluchiErrorCode, 400 | 409> = {
  not_accepting_answers: 409,
  wrong_question: 409,
  already_answered: 409,
  invalid_answer: 400,
};

const AnswerBody = z.object({ questionIndex: z.number().int().min(0), value: z.string().min(1).max(64) });

/** Participant routes, mounted by the platform at /m/tiluchi. */
export function tiluchiRoutes(app: Hono, live: LiveService) {
  app.post('/answer', async (c) => {
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new LiveError('invalid_token');
    const body = AnswerBody.parse(await c.req.json());
    try {
      return c.json(await answer(live, token, body));
    } catch (error) {
      if (error instanceof TiluchiError) return c.json({ error: error.code }, STATUS[error.code]);
      throw error;
    }
  });
}
