import type { AnswerValue, Question, QuestionType } from '@chacota/core';

export type GameStatus = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

export interface Game {
  id: string;
  pin: string;
  orgId: string;
  tiluchiId: string;
  hostUserId: string;
  title: string;
  orgName: string;
  primaryColor?: string;
  questions: Question[];
  status: GameStatus;
  /** -1 while in the lobby. */
  questionIndex: number;
  questionStartedAt?: number;
  playerCount: number;
  createdAt: string;
  endedAt?: string;
}

export interface Player {
  id: string;
  gameId: string;
  nickname: string;
  score: number;
  streak: number;
  joinedAt: number;
}

export interface Answer {
  gameId: string;
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
  imageUrl?: string;
  timeLimitSec: number;
  choices: { id: string; text: string }[];
}

export interface RankEntry {
  rank: number;
  score: number;
  /** Points earned in the question just revealed. */
  points: number;
  correct: boolean;
  answered: boolean;
}

export interface Standing {
  nickname: string;
  score: number;
}

export type GameEvent =
  | { type: 'player_joined'; nickname: string; playerCount: number }
  | {
      type: 'question';
      index: number;
      total: number;
      question: PublicQuestion;
      startedAt: number;
      serverNow: number;
    }
  | {
      type: 'reveal';
      index: number;
      correct: string[];
      counts: Record<string, number>;
      answered: number;
      top: Standing[];
      ranks: Record<string, RankEntry>;
    }
  | { type: 'leaderboard'; index: number; top: Standing[] }
  | { type: 'ended'; podium: Standing[]; ranks: Record<string, RankEntry> };

export const channels = {
  /** Everyone in the game (players and presenter). */
  public: (gameId: string) => `/game/${gameId}`,
  /** Presenter only: live join notifications. */
  host: (gameId: string) => `/game/${gameId}/host`,
};

/** Answers arriving this long after the deadline still count (network latency). */
/** Players read the question this long before answers open (and the clock starts). */
export const QUESTION_LEAD_MS = 3000;
export const ANSWER_GRACE_MS = 1500;
export const NICKNAME_MAX = 20;
