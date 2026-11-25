'use client';

import { useTranslations } from 'next-intl';
import type { FinalSnapshot } from '../model';

/** Replaces the podium once the rifa ended: every winner by round, with the reset marks, sized for a projector. */
export function RifaFinal({ snapshot }: { snapshot: Record<string, unknown> }) {
  const t = useTranslations('rifa.final');
  const winners = (snapshot as unknown as Partial<FinalSnapshot>).winners;
  const wins = winners?.filter((w) => w.kind === 'win').length ?? 0;
  // Fewer winners, bigger type; many of them spread over columns.
  const layout = wins <= 6 ? 'max-w-3xl text-4xl' : wins <= 16 ? 'max-w-5xl text-3xl md:grid-cols-2' : 'max-w-7xl text-2xl md:grid-cols-2 xl:grid-cols-3';

  return (
    <section className="flex flex-col items-center gap-10 text-center">
      <h2 className="font-display text-6xl font-extrabold tracking-tight lg:text-7xl">
        <span aria-hidden="true">👑 </span>
        {t('title')}
      </h2>
      {/* No winners at all means the final data could not be loaded, not a rifa without winners. */}
      {!winners && <p className="text-2xl text-[#ff9cc0]">{t('failed')}</p>}
      {winners && wins === 0 && <p className="text-2xl text-niebla">{t('none')}</p>}
      {winners && wins > 0 && (
        <ol className={`grid w-full gap-3 text-left ${layout}`}>
          {winners.map((w, i) =>
            w.kind === 'win' ? (
              <li
                key={`win-${w.round}`}
                className="flex items-baseline gap-4 rounded-2xl border border-sol/40 bg-linear-to-r from-sol/20 to-transparent px-5 py-3"
              >
                <span className="min-w-0 flex-1 font-display font-extrabold break-words">{w.name}</span>
                <span className="shrink-0 text-[0.6em] text-niebla">{t('round', { round: w.round })}</span>
              </li>
            ) : (
              <li key={`reset-${i}`} className="col-span-full flex items-center gap-3 text-[0.6em] text-niebla">
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
      )}
    </section>
  );
}
