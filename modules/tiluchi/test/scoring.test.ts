import { describe, expect, it } from 'vitest';
import { computePoints, isAnswerCorrect } from '../src/content/scoring';
import type { Question } from '../src/content/schema';

const quiz: Question = {
  id: 'q1',
  type: 'quiz',
  prompt: '¿Qué servicio es serverless?',
  timeLimitSec: 20,
  points: 'standard',
  choices: [
    { id: 'a', text: 'Lambda', correct: true },
    { id: 'b', text: 'EC2', correct: false },
    { id: 'c', text: 'Fargate', correct: true },
  ],
};

describe('isAnswerCorrect', () => {
  it('accepts any correct choice of a quiz', () => {
    expect(isAnswerCorrect(quiz, 'a')).toBe(true);
    expect(isAnswerCorrect(quiz, 'c')).toBe(true);
    expect(isAnswerCorrect(quiz, 'b')).toBe(false);
    expect(isAnswerCorrect(quiz, 'zzz')).toBe(false);
  });

  it('checks true/false answers', () => {
    const tf: Question = { id: 'q2', type: 'true_false', prompt: 'S3 es un servicio de almacenamiento', timeLimitSec: 10, points: 'standard', correct: true };
    expect(isAnswerCorrect(tf, 'true')).toBe(true);
    expect(isAnswerCorrect(tf, 'false')).toBe(false);
  });

  it('never marks a poll answer as correct', () => {
    const poll: Question = { id: 'q3', type: 'poll', prompt: '¿Tu región favorita?', timeLimitSec: 20, points: 'none', choices: [{ id: 'a', text: 'us-east-1', correct: false }, { id: 'b', text: 'sa-east-1', correct: false }] };
    expect(isAnswerCorrect(poll, 'a')).toBe(false);
  });
});

describe('computePoints', () => {
  const base = { correct: true, timeLimitMs: 20_000, points: 'standard' as const, streak: 1 };

  it('gives 1000 for an instant correct answer', () => {
    expect(computePoints({ ...base, elapsedMs: 0 })).toBe(1000);
  });

  it('gives 500 for a correct answer at the buzzer', () => {
    expect(computePoints({ ...base, elapsedMs: 20_000 })).toBe(500);
  });

  it('decays linearly with time', () => {
    expect(computePoints({ ...base, elapsedMs: 10_000 })).toBe(750);
  });

  it('clamps negative and late elapsed times', () => {
    expect(computePoints({ ...base, elapsedMs: -50 })).toBe(1000);
    expect(computePoints({ ...base, elapsedMs: 25_000 })).toBe(500);
  });

  it('gives 0 for wrong answers', () => {
    expect(computePoints({ ...base, correct: false, elapsedMs: 0, streak: 5 })).toBe(0);
  });

  it('doubles for double-points questions', () => {
    expect(computePoints({ ...base, points: 'double', elapsedMs: 0 })).toBe(2000);
  });

  it('gives 0 for no-points questions', () => {
    expect(computePoints({ ...base, points: 'none', elapsedMs: 0, streak: 4 })).toBe(0);
  });

  it('adds a streak bonus of 100 per extra correct answer, capped at 500', () => {
    expect(computePoints({ ...base, elapsedMs: 0, streak: 2 })).toBe(1100);
    expect(computePoints({ ...base, elapsedMs: 0, streak: 3 })).toBe(1200);
    expect(computePoints({ ...base, elapsedMs: 0, streak: 50 })).toBe(1500);
  });
});
