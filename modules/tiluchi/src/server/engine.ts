import { sortPlayers, type Player, type ResultColumn, type ResultEntry } from '@chacota/live';
import type { Question } from '../content';
import type { Answer, PublicQuestion, QuestionResult, RankEntry } from './model';

const TF_CHOICES = [
  { id: 'true', text: 'true' },
  { id: 'false', text: 'false' },
];

export function publicQuestion(q: Question, quizBackgroundKey?: string): PublicQuestion {
  return {
    type: q.type,
    prompt: q.prompt,
    imageKey: q.imageKey,
    backgroundKey: q.backgroundKey ?? quizBackgroundKey,
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

/** Rank per player plus how they did in the question just revealed. Equal scores share a rank. */
export function rankWithAnswers(players: Player[], answers: Answer[] = []): Record<string, RankEntry> {
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

export const RESULT_COLUMNS: ResultColumn[] = [
  { key: 'correct', label: { es: 'Correctas', en: 'Correct' }, format: 'int' },
  { key: 'answered', label: { es: 'Respondidas', en: 'Answered' }, format: 'int' },
  { key: 'avgCorrectTime', label: { es: 'Tiempo prom. de aciertos (s)', en: 'Avg. correct time (s)' }, format: 'seconds' },
];

/** Per-player extra columns: correct answers, answered questions and the average time of correct answers (ms). */
export function resultExtras(players: Player[], answersByQuestion: Answer[][]): Record<string, ResultEntry['extra']> {
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
  return Object.fromEntries(
    players.map((p) => {
      const stats = perPlayer.get(p.id) ?? { correct: 0, answered: 0, correctMs: 0 };
      const avgCorrectTime = stats.correct ? Math.round(stats.correctMs / stats.correct) : null;
      return [p.id, { correct: stats.correct, answered: stats.answered, avgCorrectTime }];
    }),
  );
}

export function questionResults(questions: Question[], answersByQuestion: Answer[][]): QuestionResult[] {
  return answersByQuestion.map((answers, i) => {
    const q = questions[i]!;
    return { prompt: q.prompt, type: q.type, answered: answers.length, correct: answers.filter((a) => a.correct).length };
  });
}
