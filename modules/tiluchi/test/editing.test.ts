import { describe, expect, it } from 'vitest';
import { changeType, copyOf, isQuestionValid, move, newQuestion, withFreshIds } from '../src/content/editing';
import { LIMITS, type Tiluchi } from '../src/content/schema';

describe('newQuestion', () => {
  it('creates a quiz with four answers and the first one correct', () => {
    const q = newQuestion('quiz');
    if (q.type !== 'quiz') throw new Error('expected quiz');
    expect(q.choices).toHaveLength(4);
    expect(q.choices.map((c) => c.correct)).toEqual([true, false, false, false]);
    expect(isQuestionValid(q)).toBe(false); // needs text first
    expect(isQuestionValid({ ...q, prompt: 'P', choices: q.choices.map((c, i) => ({ ...c, text: `R${i}` })) })).toBe(true);
  });
});

describe('changeType', () => {
  it('keeps image and background when changing type', () => {
    const q = { ...newQuestion('quiz'), imageKey: 'i', backgroundKey: 'b' };
    expect(changeType(q, 'poll')).toMatchObject({ imageKey: 'i', backgroundKey: 'b' });
    expect(changeType(q, 'true_false')).toMatchObject({ imageKey: 'i', backgroundKey: 'b' });
  });

  it('keeps prompt and answers when switching quiz → poll → quiz', () => {
    const quiz = { ...newQuestion('quiz'), prompt: '¿Región?' };
    const poll = changeType(quiz, 'poll');
    expect(poll).toMatchObject({ type: 'poll', prompt: '¿Región?', points: 'none' });
    if (poll.type !== 'poll') throw new Error('expected poll');
    expect(poll.choices.every((c) => !c.correct)).toBe(true);

    const back = changeType(poll, 'quiz');
    if (back.type !== 'quiz') throw new Error('expected quiz');
    expect(back.choices[0]?.correct).toBe(true);
    expect(back.points).toBe('standard');
  });

  it('adds two empty answers when leaving true/false', () => {
    const q = changeType({ ...newQuestion('true_false'), prompt: 'X' }, 'quiz');
    expect(q.type === 'quiz' && q.choices.length).toBe(2);
  });
});

describe('helpers', () => {
  it('moves items and ignores out-of-range moves', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });

  it('assigns fresh ids', () => {
    const q = newQuestion('quiz');
    const copy = withFreshIds(q);
    expect(copy.id).not.toBe(q.id);
    if (copy.type !== 'quiz' || q.type !== 'quiz') throw new Error('expected quiz');
    expect(copy.choices[0]?.id).not.toBe(q.choices[0]?.id);
  });
});

describe('copyOf', () => {
  const original: Tiluchi = {
    id: 't1',
    title: 'Trivia AWS',
    language: 'es',
    description: 'Para el meetup',
    questions: [
      { id: 'q1', type: 'quiz', prompt: 'P', timeLimitSec: 20, points: 'standard', choices: [{ id: 'a', text: 'A', correct: true }, { id: 'b', text: 'B', correct: false }] },
      { id: 'q2', type: 'true_false', prompt: 'T', timeLimitSec: 10, points: 'double', correct: true },
    ],
  };

  it('copies content with a suffix and new ids', () => {
    const copy = copyOf(original, '(copia)');
    expect(copy).toMatchObject({ title: 'Trivia AWS (copia)', language: 'es', description: 'Para el meetup' });
    expect(copy.questions.map((q) => q.prompt)).toEqual(['P', 'T']);
    expect(copy.questions.map((q) => q.id)).not.toContain('q1');
    expect(copy.questions[0]!.type === 'quiz' && copy.questions[0]!.choices.map((c) => c.id)).not.toContain('a');
  });

  it('keeps long titles within the limit', () => {
    const copy = copyOf({ ...original, title: 'x'.repeat(LIMITS.title) }, '(copia)');
    expect(copy.title.length).toBeLessThanOrEqual(LIMITS.title);
    expect(copy.title.endsWith('(copia)')).toBe(true);
  });
});
