import type { Player, RankEntry, Standing } from './model';

/** Highest score first; ties go to whoever joined first. */
export function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
}

export function topStandings(players: Player[], n = 5): Standing[] {
  return sortPlayers(players)
    .slice(0, n)
    .map((p) => ({ nickname: p.nickname, score: p.score }));
}

/** Rank per player id. Equal scores share a rank (1, 2, 2, 4). */
export function rankPlayers(players: Player[]): Record<string, RankEntry> {
  const ranks: Record<string, RankEntry> = {};
  let previousScore = Number.NaN;
  let previousRank = 0;
  sortPlayers(players).forEach((p, i) => {
    const rank = p.score === previousScore ? previousRank : i + 1;
    previousScore = p.score;
    previousRank = rank;
    ranks[p.id] = { rank, score: p.score };
  });
  return ranks;
}
