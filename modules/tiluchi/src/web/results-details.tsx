'use client';

import { useTranslations } from 'next-intl';
import type { TiluchiResultsDetails } from '../server/model';

/** Per-question stats under the ranking in the history. */
export function TiluchiResultsDetails({ details }: { details: unknown }) {
  const t = useTranslations('tiluchi.results');
  const d = details as TiluchiResultsDetails | null;
  if (!d?.questions) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-noche-3 bg-noche-2/60 p-6">
      <h3 className="font-display text-xl font-bold">{t('title')}</h3>
      <p className="text-sm text-niebla">
        {t('played', { played: d.questionsPlayed, total: d.questionCount })}
        {d.questionsPlayed < d.questionCount && ` · ${t('endedEarly')}`}
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-niebla">
          <tr>
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">{t('question')}</th>
            <th className="py-2 pr-3 text-right font-medium">{t('answers')}</th>
            <th className="py-2 text-right font-medium">{t('correct')}</th>
          </tr>
        </thead>
        <tbody>
          {d.questions.map((q, i) => (
            <tr key={i} className="border-t border-noche-3">
              <td className="py-2 pr-3 text-niebla">{i + 1}</td>
              <td className="py-2 pr-3">{q.prompt}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{q.answered}</td>
              <td className="py-2 text-right tabular-nums">{q.type === 'poll' ? '—' : q.correct}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
