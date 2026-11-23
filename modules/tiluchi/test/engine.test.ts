import type { Question } from '@chacota/tiluchi/content';
import { describe, expect, it } from 'vitest';
import { topStandings, type Player } from '@chacota/live';
import { correctValues, countAnswers, publicQuestion, rankWithAnswers, standingsBefore } from '../src/server/engine';
import type { Answer } from '../src/server/model';

const quiz: Question = {
  id: 'q', type: 'quiz', prompt: 'P', timeLimitSec: 20, points: 'standard',
  choices: [{ id: 'a', text: 'A', correct: true }, { id: 'b', text: 'B', correct: false }],
};
const tf: Question = { id: 't', type: 'true_false', prompt: 'T', timeLimitSec: 10, points: 'standard', correct: false };

const player = (id: string, score: number, joinedAt = 0): Player => ({ id, sessionId: 's', nickname: id, score, joinedAt });
const answer = (playerId: string, value: string, points: number, correct: boolean): Answer => ({
  sessionId: 's', playerId, questionIndex: 0, value, elapsedMs: 0, points, correct,
});

describe('publicQuestion', () => {
  it('never exposes the correct answer', () => {
    const pq = publicQuestion(quiz);
    expect(JSON.stringify(pq)).not.toContain('correct');
    expect(pq.choices).toEqual([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }]);
  });

  it('uses the question background, else the quiz background', () => {
    expect(publicQuestion({ ...quiz, backgroundKey: 'q-bg' }, 'quiz-bg').backgroundKey).toBe('q-bg');
    expect(publicQuestion(quiz, 'quiz-bg').backgroundKey).toBe('quiz-bg');
    expect(publicQuestion(quiz).backgroundKey).toBeUndefined();
    expect(publicQuestion({ ...quiz, imageKey: 'img' }).imageKey).toBe('img');
  });

  it('turns true/false into two fixed choices', () => {
    expect(publicQuestion(tf).choices.map((c) => c.id)).toEqual(['true', 'false']);
    expect(correctValues(tf)).toEqual(['false']);
  });
});

describe('countAnswers', () => {
  it('counts per choice and ignores unknown values', () => {
    expect(countAnswers(quiz, [answer('1', 'a', 0, true), answer('2', 'a', 0, true), answer('3', 'zz', 0, false)])).toEqual({ a: 2, b: 0 });
  });
});

describe('rankPlayers', () => {
  it('shares ranks on ties and reports the last question', () => {
    const ranks = rankWithAnswers(
      [player('x', 900, 1), player('y', 1500, 2), player('z', 900, 3), player('w', 0, 4)],
      [answer('y', 'a', 800, true), answer('x', 'b', 0, false)],
    );
    expect(ranks.y).toEqual({ rank: 1, score: 1500, points: 800, correct: true, answered: true });
    expect(ranks.x?.rank).toBe(2);
    expect(ranks.z?.rank).toBe(2);
    expect(ranks.w).toMatchObject({ rank: 4, answered: false });
  });

  it('breaks ties by join order in the standings', () => {
    expect(topStandings([player('late', 100, 9), player('early', 100, 1)]).map((s) => s.nickname)).toEqual(['early', 'late']);
  });
});

describe('standingsBefore', () => {
  it('ranks players by their score before the last question', () => {
    // y overtook x with this question; z only had what it has now.
    const players = [player('x', 900, 1), player('y', 1500, 2), player('z', 300, 3)];
    expect(standingsBefore(players, [answer('y', 'a', 800, true), answer('x', 'b', 0, false)])).toEqual([
      { nickname: 'x', score: 900 },
      { nickname: 'y', score: 700 },
      { nickname: 'z', score: 300 },
    ]);
  });

  it('keeps the top n', () => {
    const players = Array.from({ length: 7 }, (_, i) => player(`p${i}`, i * 100, i));
    expect(standingsBefore(players, [], 5)).toHaveLength(5);
  });
});
