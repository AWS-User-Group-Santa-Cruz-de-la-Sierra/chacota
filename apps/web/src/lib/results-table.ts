import type { TableRow } from '@chacota/core/tables';
import type { ResultColumn, SessionResults } from '@chacota/live';

type Translate = (key: string) => string;

export function formatCell(value: number | string | null | undefined, format: ResultColumn['format']): number | string | null {
  if (value === null || value === undefined) return null;
  // Durations are stored in milliseconds and shown in seconds with one decimal.
  if (format === 'seconds' && typeof value === 'number') return Math.round(value / 100) / 10;
  return value;
}

/** Results as a table: platform columns, then the activity's own columns in the reader's language. */
export function standingsTable(results: SessionResults, locale: 'es' | 'en', t: Translate, top?: number): TableRow[] {
  const rows = top ? results.standings.slice(0, top) : results.standings;
  return [
    [t('col.rank'), t('col.nickname'), t('col.code'), t('col.score'), ...results.columns.map((c) => c.label[locale])],
    ...rows.map((r) => [r.rank, r.nickname, r.code, r.score, ...results.columns.map((c) => formatCell(r.extra[c.key], c.format))]),
  ];
}
