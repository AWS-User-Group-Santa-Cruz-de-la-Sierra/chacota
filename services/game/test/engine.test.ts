import type { Question } from '@chacota/core';
import { describe, expect, it } from 'vitest';
import { correctValues, countAnswers, publicQuestion, rankPlayers, topStandings } from '../src/engine';
import { playerCode, type Answer, type Player } from '../src/model';
import { signPlayerToken, verifyPlayerToken } from '../src/token';

const quiz: Question = {
  id: 'q', type: 'quiz', prompt: 'P', timeLimitSec: 20, points: 'standard',
  choices: [{ id: 'a', text: 'A', correct: true }, { id: 'b', text: 'B', correct: false }],
};
const tf: Question = { id: 't', type: 'true_false', prompt: 'T', timeLimitSec: 10, points: 'standard', correct: false };

const player = (id: string, score: number, joinedAt = 0): Player => ({ id, gameId: 'g', nickname: id, score, streak: 0, joinedAt });
const answer = (playerId: string, value: string, points: number, correct: boolean): Answer => ({
  gameId: 'g', playerId, questionIndex: 0, value, elapsedMs: 0, points, correct,
});

describe('publicQuestion', () => {
  it('never exposes the correct answer', () => {
    const pq = publicQuestion(quiz);
    expect(JSON.stringify(pq)).not.toContain('correct');
    expect(pq.choices).toEqual([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }]);
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
    const ranks = rankPlayers(
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

describe('player tokens', () => {
  it('round-trips and rejects tampering', () => {
    const token = signPlayerToken('s3cret', 'game-1', 'player-1');
    expect(verifyPlayerToken('s3cret', token)).toEqual({ gameId: 'game-1', playerId: 'player-1' });
    expect(verifyPlayerToken('other', token)).toBeNull();
    expect(verifyPlayerToken('s3cret', token.replace('player-1', 'player-2'))).toBeNull();
    expect(verifyPlayerToken('s3cret', 'garbage')).toBeNull();
  });
});

describe('shardOf', () => {
  it('spreads ids evenly and deterministically', async () => {
    const { shardOf, SHARDS } = await import('../src/service');
    const counts = new Array(SHARDS).fill(0);
    for (let i = 0; i < 10_000; i++) counts[shardOf(crypto.randomUUID())]++;
    expect(Math.min(...counts)).toBeGreaterThan(800);
    expect(shardOf('same-id')).toBe(shardOf('same-id'));
  });
});

describe('playerCode', () => {
  it('is short, stable and readable', () => {
    const code = playerCode('2f1c7f0e-1234-4c3a-9a77-1e0b2f3c4d5e');
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(playerCode('2f1c7f0e-1234-4c3a-9a77-1e0b2f3c4d5e')).toBe(code);
    const codes = new Set(Array.from({ length: 1000 }, () => playerCode(crypto.randomUUID())));
    expect(codes.size).toBeGreaterThan(990);
  });
});
