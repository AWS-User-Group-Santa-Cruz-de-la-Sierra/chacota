import type { SessionResults } from '@chacota/live';
import { describe, expect, it } from 'vitest';
import { standingsTable } from './results-table';

const labels: Record<string, string> = { 'col.rank': 'Puesto', 'col.nickname': 'Apodo', 'col.code': 'Código', 'col.score': 'Puntaje' };
const t = (key: string) => labels[key] ?? key;

const base: SessionResults = {
  sessionId: 's1',
  orgId: 'o1',
  module: 'tiluchi',
  title: 'Trivia',
  hostUserId: 'h',
  createdAt: '2026-11-22T00:00:00.000Z',
  endedAt: '2026-11-22T01:00:00.000Z',
  playerCount: 2,
  podium: [],
  columns: [
    { key: 'correct', label: { es: 'Correctas', en: 'Correct' }, format: 'int' },
    { key: 'answered', label: { es: 'Respondidas', en: 'Answered' }, format: 'int' },
    { key: 'avgCorrectTime', label: { es: 'Tiempo prom. de aciertos (s)', en: 'Avg. correct time (s)' }, format: 'seconds' },
  ],
  standings: [
    { rank: 1, nickname: 'Ana', code: 'GCPK', score: 3062, extra: { correct: 2, answered: 2, avgCorrectTime: 312 } },
    { rank: 2, nickname: 'Beto', code: 'Q7Y3', score: 0, extra: { correct: 0, answered: 1, avgCorrectTime: null } },
  ],
  details: null,
};

describe('standingsTable', () => {
  it('adds the activity columns in the reader language, seconds with one decimal', () => {
    expect(standingsTable(base, 'es', t)).toEqual([
      ['Puesto', 'Apodo', 'Código', 'Puntaje', 'Correctas', 'Respondidas', 'Tiempo prom. de aciertos (s)'],
      [1, 'Ana', 'GCPK', 3062, 2, 2, 0.3],
      [2, 'Beto', 'Q7Y3', 0, 0, 1, null],
    ]);
    expect(standingsTable(base, 'en', t)[0]!.slice(4)).toEqual(['Correct', 'Answered', 'Avg. correct time (s)']);
  });

  it('keeps only the winners when asked', () => {
    expect(standingsTable(base, 'es', t, 1)).toHaveLength(2);
  });

  it('still works for activities that are no longer installed', () => {
    const gone = { ...base, module: 'gone', columns: [], standings: base.standings.map((s) => ({ ...s, extra: {} })) };
    expect(standingsTable(gone, 'es', t)[1]).toEqual([1, 'Ana', 'GCPK', 3062]);
  });
});
