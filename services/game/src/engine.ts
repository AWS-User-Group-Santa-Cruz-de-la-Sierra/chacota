import { isAnswerCorrect, type Question } from '@chacota/tiluchi/content';
import { playerCode, type Answer, type Game, type GameResults, type Player, type PublicQuestion, type RankEntry, type Standing } from './model';

const TF_CHOICES = [
  { id: 'true', text: 'true' },
  { id: 'false', text: 'false' },
];

export function publicQuestion(q: Question): PublicQuestion {
  return {
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    timeLimitSec: q.timeLimitSec,
    choices: q.type === 'true_false' ? TF_CHOICES : q.choices.map(({ id, text }) => ({ id, text })),
  };
}

export function validAnswerValues(q: Question): string[] {
  return publicQuestion(q).choices.map((c) => c.id);
}

export function correctValues(q: Question): string[] {
  switch (q.type) {
    case 'quiz':
      return q.choices.filter((c) => c.correct).map((c) => c.id);
    case 'true_false':
      return [String(q.correct)];
    case 'poll':
      return [];
  }
}

export function countAnswers(q: Question, answers: Answer[]): Record<string, number> {
  const counts = Object.fromEntries(validAnswerValues(q).map((v) => [v, 0]));
  for (const a of answers) if (a.value in counts) counts[a.value]! += 1;
  return counts;
}

/** Highest score first; ties go to whoever joined first. */
export function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
}

export function topStandings(players: Player[], n = 5): Standing[] {
  return sortPlayers(players)
    .slice(0, n)
    .map((p) => ({ nickname: p.nickname, score: p.score }));
}

/** Rank per player. Equal scores share a rank (1, 2, 2, 4). */
export function rankPlayers(players: Player[], answers: Answer[] = []): Record<string, RankEntry> {
  const byPlayer = new Map(answers.map((a) => [a.playerId, a]));
  const ranks: Record<string, RankEntry> = {};
  let previousScore = Number.NaN;
  let previousRank = 0;
  sortPlayers(players).forEach((p, i) => {
    const rank = p.score === previousScore ? previousRank : i + 1;
    previousScore = p.score;
    previousRank = rank;
    const answer = byPlayer.get(p.id);
    ranks[p.id] = {
      rank,
      score: p.score,
      points: answer?.points ?? 0,
      correct: answer?.correct ?? false,
      answered: answer !== undefined,
    };
  });
  return ranks;
}

/** Full standings and per-question stats, computed once when the game ends. */
export function buildResults(game: Game, players: Player[], answersByQuestion: Answer[][], endedAt: string): GameResults {
  const ranks = rankPlayers(players);
  const perPlayer = new Map<string, { correct: number; answered: number; correctMs: number }>();
  for (const answers of answersByQuestion) {
    for (const a of answers) {
      const stats = perPlayer.get(a.playerId) ?? { correct: 0, answered: 0, correctMs: 0 };
      stats.answered++;
      if (a.correct) {
        stats.correct++;
        stats.correctMs += Math.max(0, a.elapsedMs);
      }
      perPlayer.set(a.playerId, stats);
    }
  }
  const standings = sortPlayers(players).map((p) => {
    const stats = perPlayer.get(p.id) ?? { correct: 0, answered: 0, correctMs: 0 };
    return {
      rank: ranks[p.id]!.rank,
      nickname: p.nickname,
      code: playerCode(p.id),
      score: p.score,
      correct: stats.correct,
      answered: stats.answered,
      avgCorrectMs: stats.correct ? Math.round(stats.correctMs / stats.correct) : undefined,
    };
  });
  return {
    gameId: game.id,
    orgId: game.orgId,
    tiluchiId: game.tiluchiId,
    title: game.title,
    hostUserId: game.hostUserId,
    createdAt: game.createdAt,
    endedAt,
    playerCount: players.length,
    questionCount: game.questions.length,
    questionsPlayed: answersByQuestion.length,
    podium: topStandings(players, 3),
    standings,
    questions: answersByQuestion.map((answers, i) => {
      const q = game.questions[i]!;
      return { prompt: q.prompt, type: q.type, answered: answers.length, correct: answers.filter((a) => a.correct).length };
    }),
  };
}

export { isAnswerCorrect };
