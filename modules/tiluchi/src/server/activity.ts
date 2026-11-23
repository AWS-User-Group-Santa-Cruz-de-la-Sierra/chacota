import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LiveError, pad, SHARDS, sessionKeys, shardOf, topStandings, type ActivityServer, type LiveService, type Player, type Session } from '@chacota/live';
import { PlayableTiluchi, type Tiluchi } from '../content';
import { tiluchiManifest } from '../manifest';
import { correctValues, countAnswers, publicQuestion, questionResults, rankWithAnswers, RESULT_COLUMNS, resultExtras } from './engine';
import { QUESTION_LEAD_MS, type Answer, type TiluchiEvent, type TiluchiResultsDetails, type TiluchiSnapshot, type TiluchiState } from './model';
import { tiluchiRoutes } from './routes';

type TiluchiSession = Session<TiluchiState>;

export const answersPk = (sessionId: string, index: number, shard: number) =>
  sessionKeys.module(sessionId, 'tiluchi', `A${pad(index)}`, shard);

export const answerKey = (sessionId: string, index: number, playerId: string) => ({
  pk: answersPk(sessionId, index, shardOf(playerId)),
  sk: `ANSWER#${playerId}`,
});

const publish = (live: LiveService, sessionId: string, event: TiluchiEvent) => live.publish(sessionId, event);

export function listAnswers(live: LiveService, sessionId: string, index: number): Promise<Answer[]> {
  return live.queryShards<Answer>((shard) => answersPk(sessionId, index, shard));
}

async function countAnswerItems(live: LiveService, sessionId: string, index: number): Promise<number> {
  const counts = await Promise.all(
    Array.from({ length: SHARDS }, async (_, shard) => {
      let count = 0;
      let start: Record<string, unknown> | undefined;
      do {
        const page = await live.db.doc.send(
          new QueryCommand({
            TableName: live.db.tableName,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': answersPk(sessionId, index, shard) },
            Select: 'COUNT',
            ExclusiveStartKey: start,
          }),
        );
        count += page.Count ?? 0;
        start = page.LastEvaluatedKey;
      } while (start);
      return count;
    }),
  );
  return counts.reduce((a, b) => a + b, 0);
}

const streakOf = (p: Player) => Number(p.data?.streak ?? 0);

/** A player who skips a question loses their streak. */
async function resetStreaksOfSilentPlayers(live: LiveService, sessionId: string, players: Player[], answers: Answer[]) {
  const answered = new Set(answers.map((a) => a.playerId));
  const silent = players.filter((p) => streakOf(p) > 0 && !answered.has(p.id));
  await Promise.all(
    silent.map((p) =>
      live.db.doc.send(
        new UpdateCommand({
          TableName: live.db.tableName,
          Key: sessionKeys.player(sessionId, p.id),
          UpdateExpression: 'SET #data = :data',
          ExpressionAttributeNames: { '#data': 'data' },
          ExpressionAttributeValues: { ':data': { ...p.data, streak: 0 } },
        }),
      ),
    ),
  );
}

async function startQuestion(live: LiveService, session: TiluchiSession): Promise<TiluchiSession> {
  const index = session.state.questionIndex + 1;
  // Answers open after a short reading time; everyone gets the same head start.
  const startedAt = live.now() + QUESTION_LEAD_MS;
  const updated = await live.transition(session, {
    state: { ...session.state, phase: 'question' as const, questionIndex: index, questionStartedAt: startedAt },
  });
  await publish(live, session.id, {
    type: 'tiluchi.question',
    index,
    total: session.state.questions.length,
    question: publicQuestion(session.state.questions[index]!),
    startedAt,
    serverNow: live.now(),
  });
  return updated;
}

async function reveal(live: LiveService, session: TiluchiSession): Promise<TiluchiSession> {
  const { questionIndex: index, questions } = session.state;
  const question = questions[index]!;
  const updated = await live.transition(session, { state: { ...session.state, phase: 'reveal' as const } });
  const [answers, players] = await Promise.all([listAnswers(live, session.id, index), live.listPlayers(session.id)]);
  await resetStreaksOfSilentPlayers(live, session.id, players, answers);
  await publish(live, session.id, {
    type: 'tiluchi.reveal',
    index,
    correct: correctValues(question),
    counts: countAnswers(question, answers),
    answered: answers.length,
    top: topStandings(players),
    ranks: rankWithAnswers(players, answers),
  });
  return updated;
}

async function showLeaderboard(live: LiveService, session: TiluchiSession): Promise<TiluchiSession> {
  const updated = await live.transition(session, { state: { ...session.state, phase: 'leaderboard' as const } });
  const players = await live.listPlayers(session.id);
  await publish(live, session.id, { type: 'tiluchi.leaderboard', index: session.state.questionIndex, top: topStandings(players) });
  return updated;
}

export const tiluchiActivity: ActivityServer<Tiluchi, TiluchiState> = {
  manifest: tiluchiManifest,

  prepare(content) {
    const playable = PlayableTiluchi.safeParse(content);
    if (!playable.success) throw new LiveError('not_playable');
    return {
      title: content.title,
      state: { tiluchiId: content.id, questions: playable.data.questions, phase: 'lobby', questionIndex: -1 },
    };
  },

  async advance(live, session) {
    switch (session.state.phase) {
      case 'lobby':
      case 'leaderboard':
        return session.state.questionIndex + 1 < session.state.questions.length
          ? startQuestion(live, session)
          : live.end<TiluchiState>(session.id);
      case 'question':
        return reveal(live, session);
      case 'reveal':
        return showLeaderboard(live, session);
    }
  },

  async snapshot(live, session, playerId) {
    const { phase, questionIndex: index, questions, questionStartedAt } = session.state;
    const question = index >= 0 ? questions[index] : undefined;
    const answer = playerId && question ? await getAnswer(live, session.id, index, playerId) : undefined;
    const snapshot: TiluchiSnapshot = {
      phase,
      index,
      total: questions.length,
      startedAt: questionStartedAt,
      question: question && phase === 'question' ? publicQuestion(question) : undefined,
      answered: answer ? { value: answer.value } : undefined,
    };
    return { ...snapshot };
  },

  async results(live, session, players) {
    const { phase, questionIndex, questions } = session.state;
    const played = phase === 'lobby' ? 0 : questionIndex + 1;
    const answersByQuestion = await Promise.all(Array.from({ length: Math.max(0, played) }, (_, i) => listAnswers(live, session.id, i)));
    const details: TiluchiResultsDetails = {
      questionCount: questions.length,
      questionsPlayed: answersByQuestion.length,
      questions: questionResults(questions, answersByQuestion),
    };
    return { columns: RESULT_COLUMNS, extra: resultExtras(players, answersByQuestion), details };
  },

  hostActions: {
    async countAnswers(live, session, args) {
      const index = Number((args as { index?: number })?.index ?? session.state.questionIndex);
      return countAnswerItems(live, session.id, index);
    },
  },

  routes: tiluchiRoutes,
};

export async function getAnswer(live: LiveService, sessionId: string, index: number, playerId: string): Promise<Answer | undefined> {
  const { Item } = await live.db.doc.send(
    new GetCommand({
      TableName: live.db.tableName,
      Key: answerKey(sessionId, index, playerId),
      ConsistentRead: true,
    }),
  );
  return Item as Answer | undefined;
}
