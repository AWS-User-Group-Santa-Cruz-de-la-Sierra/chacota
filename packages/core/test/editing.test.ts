import { describe, expect, it } from 'vitest';
import { changeType, isQuestionValid, move, newQuestion, withFreshIds } from '../src/editing';

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
