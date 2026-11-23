/** Seconds around each question besides its time limit: reading, showing the answer and the ranking. */
const OVERHEAD_PER_QUESTION_SEC = 20;

/** Rough length of a game in whole minutes, for the lobby. */
export function estimateMinutes(questions: { timeLimitSec: number }[]): number {
  const seconds = questions.reduce((sum, q) => sum + q.timeLimitSec + OVERHEAD_PER_QUESTION_SEC, 0);
  return Math.ceil(seconds / 60);
}
