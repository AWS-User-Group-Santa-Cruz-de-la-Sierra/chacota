import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { isConditionalCheckFailure } from '@chacota/db';
import { LiveError, sessionKeys, type LiveService } from '@chacota/live';
import { computePoints, isAnswerCorrect } from '../content';
import { answerKey } from './activity';
import { validAnswerValues } from './engine';
import { ANSWER_GRACE_MS, type Answer, type TiluchiState } from './model';

export type TiluchiErrorCode = 'not_accepting_answers' | 'wrong_question' | 'already_answered' | 'invalid_answer';

export class TiluchiError extends Error {
  constructor(readonly code: TiluchiErrorCode) {
    super(code);
    this.name = 'TiluchiError';
  }
}

/** Scores an answer with the server clock. Each player answers each question at most once. */
export async function answer(live: LiveService, token: string, input: { questionIndex: number; value: string }): Promise<{ accepted: true }> {
  const { sessionId, playerId } = live.verifyToken(token);
  const receivedAt = live.now();
  const [session, player] = await Promise.all([live.getSession<TiluchiState>(sessionId), live.getPlayer(sessionId, playerId)]);
  if (!session || !player) throw new LiveError('session_not_found');
  const state = session.state;
  if (session.status !== 'running' || state.phase !== 'question' || state.questionStartedAt === undefined) {
    throw new TiluchiError('not_accepting_answers');
  }
  if (input.questionIndex !== state.questionIndex) throw new TiluchiError('wrong_question');

  const question = state.questions[state.questionIndex]!;
  if (!validAnswerValues(question).includes(input.value)) throw new TiluchiError('invalid_answer');
  const timeLimitMs = question.timeLimitSec * 1000;
  const elapsedMs = receivedAt - state.questionStartedAt;
  // Small tolerance for clock-offset estimation on the client.
  if (elapsedMs < -500) throw new TiluchiError('not_accepting_answers');
  if (elapsedMs > timeLimitMs + ANSWER_GRACE_MS) throw new TiluchiError('not_accepting_answers');

  const correct = isAnswerCorrect(question, input.value);
  const previousStreak = Number(player.data?.streak ?? 0);
  const streak = correct ? previousStreak + 1 : 0;
  const points = computePoints({ correct, elapsedMs, timeLimitMs, points: question.points, streak });
  const stored: Answer = { sessionId, playerId, questionIndex: state.questionIndex, value: input.value, elapsedMs, correct, points };

  try {
    await live.db.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: live.db.tableName,
              Item: { ...answerKey(sessionId, state.questionIndex, playerId), ...stored, ttl: live.ttl() },
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          {
            Update: {
              TableName: live.db.tableName,
              Key: sessionKeys.player(sessionId, playerId),
              UpdateExpression: 'ADD score :points SET #data = :data',
              ExpressionAttributeNames: { '#data': 'data' },
              ExpressionAttributeValues: { ':points': points, ':data': { ...player.data, streak: question.type === 'poll' ? previousStreak : streak } },
            },
          },
        ],
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailure(error)) throw new TiluchiError('already_answered');
    throw error;
  }
  return { accepted: true };
}
