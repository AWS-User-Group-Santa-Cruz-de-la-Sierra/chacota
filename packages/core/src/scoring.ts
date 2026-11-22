import type { AnswerValue, PointsMode, Question } from './schema.js';

export const MAX_BASE_POINTS = 1000;
export const STREAK_BONUS_STEP = 100;
export const STREAK_BONUS_CAP = 500;

const MULTIPLIER: Record<PointsMode, number> = { standard: 1, double: 2, none: 0 };

export function isAnswerCorrect(question: Question, answer: AnswerValue): boolean {
  switch (question.type) {
    case 'quiz':
      return question.choices.some((c) => c.id === answer && c.correct);
    case 'true_false':
      return answer === String(question.correct);
    case 'poll':
      return false;
  }
}

export interface PointsInput {
  correct: boolean;
  /** Server-measured time between question start and answer. */
  elapsedMs: number;
  timeLimitMs: number;
  points: PointsMode;
  /** Consecutive correct answers including this one. */
  streak: number;
}

/**
 * Kahoot-style scoring: a correct answer is worth between 1000 (instant) and
 * 500 (at the buzzer), scaled by the question's multiplier, plus a streak bonus.
 */
export function computePoints({ correct, elapsedMs, timeLimitMs, points, streak }: PointsInput): number {
  const multiplier = MULTIPLIER[points];
  if (!correct || multiplier === 0) return 0;

  const ratio = Math.min(Math.max(elapsedMs / timeLimitMs, 0), 1);
  const base = Math.round(MAX_BASE_POINTS * (1 - ratio / 2)) * multiplier;
  const bonus = Math.min(Math.max(streak - 1, 0) * STREAK_BONUS_STEP, STREAK_BONUS_CAP);
  return base + bonus;
}
