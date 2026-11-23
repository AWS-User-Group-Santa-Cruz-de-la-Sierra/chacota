import 'server-only';
import type { TableRow } from '@chacota/core/tables';
import type { GameResults } from '@chacota/game';
import { notFound } from 'next/navigation';
import { requireOrgAccess } from './auth';
import { getGameService } from './game';

/** Results of a game in the given organization, for any of its members. */
export async function requireOrgResults(slug: string, gameId: string) {
  const access = await requireOrgAccess(slug);
  const game = await getGameService().getGame(gameId);
  if (!game || game.orgId !== access.org.id) notFound();
  const results = await getGameService().getResults(game);
  if (!results) notFound();
  return { ...access, results };
}

type Translate = (key: string) => string;

export function standingsTable(results: GameResults, t: Translate, top?: number): TableRow[] {
  const rows = top ? results.standings.slice(0, top) : results.standings;
  return [
    ['rank', 'nickname', 'code', 'score', 'correct', 'answered', 'avgTime'].map((c) => t(`col.${c}`)),
    ...rows.map((r) => [
      r.rank,
      r.nickname,
      r.code,
      r.score,
      r.correct,
      r.answered,
      r.avgCorrectMs === undefined ? null : Math.round(r.avgCorrectMs / 100) / 10,
    ]),
  ];
}

export function resultsFilename(results: GameResults, suffix: string, ext: string) {
  const title = results.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'tiluchi';
  return `${title}-${results.endedAt.slice(0, 10)}${suffix}.${ext}`;
}
