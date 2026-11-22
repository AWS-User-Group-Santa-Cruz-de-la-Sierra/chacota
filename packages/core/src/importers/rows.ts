import { newId } from '../ids';
import { DEFAULT_TIME_LIMIT, LIMITS, TIME_LIMITS, type Choice, type Question } from '../schema';
import { ImportError, type ImportResult, type ImportWarning } from './types';

/**
 * Shared parser for the Kahoot spreadsheet layout (also used for CSV):
 * Question | Answer 1..6 | Time limit (sec) | Correct answer(s)
 * The header row may be preceded by instruction rows and an index column,
 * and may be written in English or Spanish.
 */

interface Columns {
  question: number;
  answers: number[];
  time?: number;
  correct?: number;
}

const QUESTION_RE = /^(question|pregunta)\b/i;
const ANSWER_RE = /^(answer|respuesta|opci[oó]n)\s*([1-6])\b/i;
const TIME_RE = /^(time|tiempo)/i;
const CORRECT_RE = /^(correct|respuestas?\s*\(?s?\)?\s*correctas?|correctas?)/i;

const TRUE_WORDS = new Set(['true', 'verdadero', 'cierto', 'v']);
const FALSE_WORDS = new Set(['false', 'falso', 'f']);

function findColumns(row: string[]): Columns | undefined {
  const question = row.findIndex((c) => QUESTION_RE.test(c.trim()));
  if (question === -1) return undefined;

  const answers: number[] = [];
  let time: number | undefined;
  let correct: number | undefined;
  row.forEach((raw, i) => {
    const cell = raw.trim();
    const answer = ANSWER_RE.exec(cell);
    if (answer) answers[Number(answer[2]) - 1] = i;
    else if (TIME_RE.test(cell)) time = i;
    else if (CORRECT_RE.test(cell)) correct = i;
  });
  const dense = answers.filter((i) => i !== undefined);
  if (dense.length < 2) return undefined;
  return { question, answers: dense, time, correct };
}

function clip(text: string, max: number, onTruncate: () => void): string {
  if (text.length <= max) return text;
  onTruncate();
  return text.slice(0, max);
}

function closestTimeLimit(value: number): number {
  return TIME_LIMITS.reduce((best, t) => (Math.abs(t - value) < Math.abs(best - value) ? t : best));
}

function parseCorrect(raw: string, answerCount: number): number[] {
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= answerCount)
        .map((n) => n - 1),
    ),
  ];
}

function boolWord(text: string): boolean | undefined {
  const t = text.trim().toLowerCase();
  if (TRUE_WORDS.has(t)) return true;
  if (FALSE_WORDS.has(t)) return false;
  return undefined;
}

export function parseQuestionRows(rows: string[][]): ImportResult {
  const headerIndex = rows.findIndex((r) => findColumns(r) !== undefined);
  if (headerIndex === -1) {
    throw new ImportError(
      'header_not_found',
      'No header row found. Expected columns: Question, Answer 1, Answer 2, ..., Time limit (sec), Correct answer(s)',
    );
  }
  const cols = findColumns(rows[headerIndex]!)!;
  const questions: Question[] = [];
  const warnings: ImportWarning[] = [];

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const cell = (i: number | undefined) => (i === undefined ? '' : (row[i] ?? '').trim());
    const warn = (code: ImportWarning['code'], detail?: string) =>
      warnings.push(detail === undefined ? { row: rowNumber, code } : { row: rowNumber, code, detail });

    let truncated = false;
    const markTruncated = () => (truncated = true);

    const prompt = clip(cell(cols.question), LIMITS.prompt, markTruncated);
    const answerTexts = cols.answers.map((i) => cell(i));
    if (!prompt && answerTexts.every((a) => !a)) return; // blank row

    // Keep original positions so "Correct answer(s)" numbers still line up.
    const positioned = answerTexts
      .map((text, position) => ({ text: clip(text, LIMITS.choice, markTruncated), position }))
      .filter((a) => a.text);
    if (!prompt || positioned.length < LIMITS.minChoices) {
      warn('row_skipped_not_enough_answers');
      return;
    }

    let timeLimitSec: number = DEFAULT_TIME_LIMIT;
    const rawTime = cell(cols.time);
    const parsedTime = Number.parseFloat(rawTime);
    if (!rawTime || !Number.isFinite(parsedTime)) {
      warn('time_limit_defaulted');
    } else {
      timeLimitSec = closestTimeLimit(parsedTime);
      if (timeLimitSec !== parsedTime) warn('time_limit_adjusted', `${rawTime} → ${timeLimitSec}`);
    }

    if (truncated) warn('text_truncated');

    const correctPositions = parseCorrect(cell(cols.correct), answerTexts.length);
    const base = { id: newId(), prompt, timeLimitSec };

    const [first, second] = positioned;
    const firstBool = boolWord(first!.text);
    const secondBool = boolWord(second!.text);
    if (
      positioned.length === 2 &&
      firstBool !== undefined &&
      secondBool === !firstBool &&
      correctPositions.length === 1
    ) {
      const correctIsFirst = correctPositions[0] === first!.position;
      questions.push({
        ...base,
        type: 'true_false',
        points: 'standard',
        correct: correctIsFirst ? firstBool : secondBool,
      });
      return;
    }

    const choices: Choice[] = positioned.map((a) => ({
      id: newId(),
      text: a.text,
      correct: correctPositions.includes(a.position),
    }));

    if (!choices.some((c) => c.correct)) {
      warn('imported_as_poll');
      questions.push({
        ...base,
        type: 'poll',
        points: 'none',
        choices: choices.map((c) => ({ ...c, correct: false as const })),
      });
      return;
    }

    questions.push({ ...base, type: 'quiz', points: 'standard', choices: choices.slice(0, LIMITS.maxChoices) });
  });

  return { tiluchi: { questions }, warnings };
}
