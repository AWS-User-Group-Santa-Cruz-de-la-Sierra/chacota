import { describe, expect, it } from 'vitest';
import { dropForeignMedia, tiluchiMediaKeys } from '../src/content/media';
import type { Question } from '../src/content/schema';

const quiz: Question = {
  id: 'q', type: 'quiz', prompt: 'P', timeLimitSec: 20, points: 'standard',
  choices: [{ id: 'a', text: 'A', correct: true }, { id: 'b', text: 'B', correct: false }],
};
const own = 'orgs/o1/media/a.webp';
const other = 'orgs/o2/media/b.webp';

describe('tiluchi media', () => {
  it('lists every key it uses', () => {
    expect(tiluchiMediaKeys({ backgroundKey: own, questions: [{ ...quiz, imageKey: own, backgroundKey: other }, quiz] })).toEqual([own, own, other]);
  });

  it('drops keys from other orgs and counts them', () => {
    const { tiluchi, removed } = dropForeignMedia({ backgroundKey: other, questions: [{ ...quiz, imageKey: own, backgroundKey: other }] }, 'o1');
    expect(removed).toBe(2);
    expect(tiluchi.backgroundKey).toBeUndefined();
    expect(tiluchi.questions[0]).toMatchObject({ imageKey: own });
    expect(tiluchi.questions[0]).not.toHaveProperty('backgroundKey');
  });

  it('leaves content without foreign keys untouched', () => {
    const input = { questions: [{ ...quiz, imageKey: own }] };
    expect(dropForeignMedia(input, 'o1')).toEqual({ tiluchi: input, removed: 0 });
  });
});
