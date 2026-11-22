import { isAnswerCorrect, type Question } from '@chacota/core';
import type { Answer, Player, PublicQuestion, RankEntry, Standing } from './model';

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

export { isAnswerCorrect };
