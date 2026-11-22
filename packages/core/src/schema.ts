import { z } from 'zod';

/** Time limits (seconds) offered in the editor. Matches Kahoot's options. */
export const TIME_LIMITS = [5, 10, 20, 30, 60, 90, 120, 240] as const;
export const DEFAULT_TIME_LIMIT = 20;

export const LIMITS = {
  title: 120,
  description: 500,
  prompt: 280,
  choice: 120,
  minChoices: 2,
  maxChoices: 6,
  maxQuestions: 100,
} as const;

export const Language = z.enum(['es', 'en']);
export type Language = z.infer<typeof Language>;

export const PointsMode = z.enum(['standard', 'double', 'none']);
export type PointsMode = z.infer<typeof PointsMode>;

const id = z.string().min(1).max(64);

const questionBase = {
  id,
  prompt: z.string().trim().min(1).max(LIMITS.prompt),
  imageUrl: z.string().url().optional(),
  timeLimitSec: z.number().int().min(5).max(240),
  points: PointsMode,
};

export const Choice = z.object({
  id,
  text: z.string().trim().min(1).max(LIMITS.choice),
  correct: z.boolean(),
});
export type Choice = z.infer<typeof Choice>;

export const QuizQuestion = z
  .object({
    ...questionBase,
    type: z.literal('quiz'),
    choices: z.array(Choice).min(LIMITS.minChoices).max(LIMITS.maxChoices),
  })
  .refine((q) => q.choices.some((c) => c.correct), {
    message: 'A quiz question needs at least one correct choice',
    path: ['choices'],
  });

export const TrueFalseQuestion = z.object({
  ...questionBase,
  type: z.literal('true_false'),
  correct: z.boolean(),
});

export const PollQuestion = z.object({
  ...questionBase,
  type: z.literal('poll'),
  choices: z
    .array(Choice.extend({ correct: z.literal(false) }))
    .min(LIMITS.minChoices)
    .max(LIMITS.maxChoices),
  points: z.literal('none'),
});

export const Question = z.discriminatedUnion('type', [
  QuizQuestion,
  TrueFalseQuestion,
  PollQuestion,
]);
export type Question = z.infer<typeof Question>;
export type QuestionType = Question['type'];

export const Tiluchi = z.object({
  id,
  title: z.string().trim().min(1).max(LIMITS.title),
  description: z.string().max(LIMITS.description).optional(),
  language: Language,
  coverImageUrl: z.string().url().optional(),
  questions: z.array(Question).max(LIMITS.maxQuestions),
});
export type Tiluchi = z.infer<typeof Tiluchi>;

/** A tiluchi can only be played with at least one question. */
export const PlayableTiluchi = Tiluchi.extend({
  questions: z.array(Question).min(1).max(LIMITS.maxQuestions),
});

/** Answer a player submits: the chosen choice id, or 'true' / 'false'. */
export type AnswerValue = string;
