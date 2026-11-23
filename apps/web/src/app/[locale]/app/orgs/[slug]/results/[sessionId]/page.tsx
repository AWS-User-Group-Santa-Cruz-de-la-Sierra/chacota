import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import type { TiluchiResultsDetails } from '@chacota/tiluchi/model';
import { requireOrgResults } from '@/lib/results';
import { standingsTable } from '@/lib/results-table';
import { ResultsTable } from './results-table';

export default async function SessionResultsPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const { results } = await requireOrgResults(slug, sessionId);
  const t = await getTranslations('results');
  const format = await getFormatter();
  const locale = (await getLocale()) === 'en' ? 'en' : 'es';
  // Tiluchi details until activities render their own (see ActivityWeb.ResultsDetails).
  const details = results.module === 'tiluchi' ? (results.details as TiluchiResultsDetails) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/app/orgs/${slug}/results`} className="text-sm text-niebla hover:text-blanco">
          ← {t('back')}
        </Link>
        <h2 className="font-display text-3xl font-extrabold">{results.title}</h2>
        <p className="text-niebla">
          {t('meta', {
            date: format.dateTime(new Date(results.endedAt), { dateStyle: 'full', timeStyle: 'short' }),
            players: t('players', { count: results.playerCount }),
          })}
          {details && ` · ${t('questionsPlayed', { played: details.questionsPlayed, total: details.questionCount })}`}
          {details && details.questionsPlayed < details.questionCount && ` · ${t('endedEarly')}`}
        </p>
      </div>

      <ResultsTable
        rows={standingsTable(results, locale, (key) => t(key))}
        codes={results.standings.map((s) => ({ rank: s.rank, nickname: s.nickname, code: s.code, score: s.score }))}
        exportBase={`/api/orgs/${slug}/results/${sessionId}/export?locale=${locale}`}
      />

      {details && (
      <Card className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-bold">{t('questions')}</h3>
        <table className="w-full text-left text-sm">
          <thead className="text-niebla">
            <tr>
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">{t('col.question')}</th>
              <th className="py-2 pr-3 text-right font-medium">{t('col.answeredCount')}</th>
              <th className="py-2 text-right font-medium">{t('col.correctCount')}</th>
            </tr>
          </thead>
          <tbody>
            {details?.questions.map((q, i) => (
              <tr key={i} className="border-t border-noche-3">
                <td className="py-2 pr-3 text-niebla">{i + 1}</td>
                <td className="py-2 pr-3">{q.prompt}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{q.answered}</td>
                <td className="py-2 text-right tabular-nums">{q.type === 'poll' ? '—' : q.correct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      )}
    </div>
  );
}
