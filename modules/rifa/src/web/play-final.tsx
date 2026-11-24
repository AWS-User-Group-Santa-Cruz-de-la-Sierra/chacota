'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { FinalSnapshot } from '../model';

/**
 * The phone's line once the rifa ended: the rounds this player won. Nothing when they won none;
 * the frame already thanks them and shows the code.
 */
export function RifaPlayFinal({ snapshot, playerId }: { snapshot: Record<string, unknown>; playerId: string }) {
  const t = useTranslations('rifa.play');
  const format = useFormatter();
  const s = snapshot as unknown as Partial<FinalSnapshot>;
  const wins = s.wins ?? s.winners?.flatMap((w) => (w.kind === 'win' && w.entryId === playerId ? [w.round] : [])) ?? [];
  if (wins.length === 0) return null;
  const rounds = format.list(wins.map(String), { type: 'conjunction' });
  return (
    <p className="font-display text-2xl font-bold text-sol">
      <span aria-hidden="true">👑 </span>
      {t('final', { count: wins.length, rounds })}
    </p>
  );
}
