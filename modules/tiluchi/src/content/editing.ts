import {
  DEFAULT_TIME_LIMIT,
  LIMITS,
  Question,
  type Choice,
  type QuestionType,
  type Tiluchi,
} from './schema';
import { newId } from '@chacota/core';

export function newChoice(text = ''): Choice {
  return { id: newId(), text, correct: false };
}

export function newQuestion(type: QuestionType = 'quiz'): Question {
  const base = { id: newId(), prompt: '', timeLimitSec: DEFAULT_TIME_LIMIT };
  switch (type) {
    case 'true_false':
      return { ...base, type, points: 'standard', correct: true };
    case 'poll':
      return { ...base, type, points: 'none', choices: [newChoice(), newChoice()].map((c) => ({ ...c, correct: false as const })) };
    case 'quiz':
      return { ...base, type, points: 'standard', choices: [{ ...newChoice(), correct: true }, newChoice(), newChoice(), newChoice()] };
  }
}

/** Converts a question to another type, keeping the prompt, time and as many answers as possible. */
export function changeType(q: Question, type: QuestionType): Question {
  if (q.type === type) return q;
  const common = { id: q.id, prompt: q.prompt, timeLimitSec: q.timeLimitSec, imageUrl: q.imageUrl };
  const existing = q.type === 'true_false' ? [] : q.choices;
  const choices = existing.length >= LIMITS.minChoices ? existing : [newChoice(), newChoice()];
  switch (type) {
    case 'true_false':
      return { ...common, type, points: q.points === 'none' ? 'standard' : q.points, correct: true };
    case 'poll':
      return { ...common, type, points: 'none', choices: choices.map((c) => ({ ...c, correct: false as const })) };
    case 'quiz': {
      const quizChoices = choices.some((c) => c.correct) ? choices : choices.map((c, i) => ({ ...c, correct: i === 0 }));
      return { ...common, type, points: q.points === 'none' ? 'standard' : q.points, choices: quizChoices };
    }
  }
}

export function isQuestionValid(q: Question): boolean {
  return Question.safeParse(q).success;
}

/** Gives every question and choice fresh ids so imported content never collides with existing ids. */
export function withFreshIds(q: Question): Question {
  if (q.type === 'true_false') return { ...q, id: newId() };
  return { ...q, id: newId(), choices: q.choices.map((c) => ({ ...c, id: newId() })) } as Question;
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Content for a copy of a tiluchi: same questions with new ids, and the suffix after the title. */
export function copyOf(tiluchi: Pick<Tiluchi, 'title' | 'language' | 'description' | 'questions'>, suffix: string) {
  const room = LIMITS.title - suffix.length - 1;
  return {
    title: `${tiluchi.title.slice(0, room).trimEnd()} ${suffix}`,
    language: tiluchi.language,
    description: tiluchi.description,
    questions: tiluchi.questions.map(withFreshIds),
  };
}
