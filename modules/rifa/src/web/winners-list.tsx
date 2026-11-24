'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import type { WinnersItem } from '../model';

/** The winners by round beside the stage, with the reset marks. The newest is at the bottom and kept in view. */
export function WinnersList({ winners }: { winners: WinnersItem[] }) {
  const t = useTranslations('rifa.host');
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [winners.length]);

  return (
    <section className="flex h-full flex-col gap-3 rounded-3xl bg-noche-2 p-4">
      <h2 className="font-display text-2xl font-extrabold">
        <span aria-hidden="true">👑 </span>
        {t('winners')}
      </h2>
      {winners.length === 0 && <p className="text-niebla">{t('noWinners')}</p>}
      <ol ref={list} className="flex max-h-52 min-h-0 flex-1 flex-col gap-2 overflow-y-auto lg:max-h-none">
        {winners.map((w, i) =>
          w.kind === 'win' ? (
            <li
              key={`win-${w.round}`}
              className="flex items-baseline gap-3 rounded-xl border border-sol/40 bg-linear-to-r from-sol/20 to-transparent px-3 py-2 text-xl font-bold"
            >
              <span className="min-w-0 flex-1 break-words">{w.name}</span>
              <span className="shrink-0 text-sm font-normal text-niebla">{t('round', { round: w.round })}</span>
            </li>
          ) : (
            <li key={`reset-${i}`} className="flex items-center gap-2 py-1 text-sm text-niebla">
              <span className="h-px flex-1 bg-noche-3" aria-hidden="true" />
              <span>
                <span aria-hidden="true">↺ </span>
                {t('reset')}
              </span>
              <span className="h-px flex-1 bg-noche-3" aria-hidden="true" />
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
