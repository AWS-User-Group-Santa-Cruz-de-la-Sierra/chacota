'use client';

import { useTranslations } from 'next-intl';
import type { EmbolsauConfig, RoundPlace } from '../model';

interface Details {
  config: EmbolsauConfig;
  rounds: { round: number; top: RoundPlace[] }[];
}

/** The top 10 of each race in the history. */
export function EmbolsauResultsDetails({ details }: { details: unknown }) {
  const t = useTranslations('embolsau.host');
  const d = details as Details | null;
  if (!d?.rounds?.length) return null;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-noche-3 bg-noche-2/60 p-6">
      <p className="text-sm text-niebla">{t('lobbySummary', { rounds: d.config.rounds, track: t(`tracks.${d.config.track}`), meter: t(d.config.meter ? 'withMeter' : 'blind') })}</p>
      {d.rounds.map((r) => (
        <div key={r.round} className="flex flex-col gap-2">
          <h3 className="font-display text-xl font-bold">{t('roundTitle', { round: r.round })}</h3>
          <table className="w-full text-left text-sm">
            <tbody>
              {r.top.map((p) => (
                <tr key={p.playerId} className="border-t border-noche-3">
                  <td className="py-1.5 pr-3 text-niebla">{p.place}</td>
                  <td className="py-1.5 pr-3">{p.nickname}</td>
                  <td className="py-1.5 pr-3 text-right">{p.timeMs === null ? t('table.meters', { meters: Math.round(p.meters) }) : t('table.seconds', { seconds: (p.timeMs / 1000).toFixed(1) })}</td>
                  <td className="py-1.5 text-right">+{p.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
