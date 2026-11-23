import type { RankEntry as LiveRankEntry, Standing } from '@chacota/live';
import type { AnswerValue, Question, QuestionType } from '../content';

/** Players read the question this long before answers open (and the clock starts). */
export const QUESTION_LEAD_MS = 3000;
/** Answers arriving this long after the deadline still count (network latency). */
export const ANSWER_GRACE_MS = 1500;

export type TiluchiPhase = 'lobby' | 'question' | 'reveal' | 'leaderboard';

export interface TiluchiState {
  tiluchiId: string;
  questions: Question[];
  /** Background of the whole quiz, for questions without their own. */
  backgroundKey?: string;
  phase: TiluchiPhase;
  /** -1 until the first question. */
  questionIndex: number;
  questionStartedAt?: number;
}

export interface Answer {
  sessionId: string;
  playerId: string;
  questionIndex: number;
  value: AnswerValue;
  elapsedMs: number;
  correct: boolean;
  points: number;
}

/** What participants may see of a question: never which answer is correct. */
export interface PublicQuestion {
  type: QuestionType;
  prompt: string;
  imageKey?: string;
  /** The question's background, or else the quiz's. */
  backgroundKey?: string;
  timeLimitSec: number;
  choices: { id: string; text: string }[];
}

export interface RankEntry extends LiveRankEntry {
  /** Points earned in the question just revealed. */
  points: number;
  correct: boolean;
  answered: boolean;
}

export interface QuestionResult {
  prompt: string;
  type: QuestionType;
  answered: number;
  correct: number;
}

export interface TiluchiResultsDetails {
  questionCount: number;
  questionsPlayed: number;
  questions: QuestionResult[];
}

export type TiluchiEvent =
  | { type: 'tiluchi.question'; index: number; total: number; question: PublicQuestion; startedAt: number; serverNow: number }
  | {
      type: 'tiluchi.reveal';
      index: number;
      correct: string[];
      counts: Record<string, number>;
      answered: number;
      top: Standing[];
      ranks: Record<string, RankEntry>;
    }
  | {
      type: 'tiluchi.leaderboard';
      index: number;
      top: Standing[];
      /** The top as it was before this question, so the screen can animate the change. */
      before: Standing[];
    };

/** Snapshot a reconnecting client gets in `snapshot.module`. */
export interface TiluchiSnapshot {
  phase: TiluchiPhase;
  index: number;
  total: number;
  startedAt?: number;
  question?: PublicQuestion;
  answered?: { value: string };
  /** Presenter only. */
  questions?: PublicQuestion[];
}
