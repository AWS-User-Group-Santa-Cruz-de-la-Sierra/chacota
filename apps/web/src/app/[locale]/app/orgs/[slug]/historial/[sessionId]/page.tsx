import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { activityWebs } from '@/activities/registry.client';
import { requireOrgResults } from '@/lib/results';
import { standingsTable } from '@/lib/results-table';
import { ResultsTable } from './results-table';

export default async function SessionResultsPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const { results } = await requireOrgResults(slug, sessionId);
  const t = await getTranslations('results');
  const format = await getFormatter();
  const locale = (await getLocale()) === 'en' ? 'en' : 'es';
  // Only installed activities can show their details.
  const Details = activityWebs[results.module]?.ResultsDetails;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/app/orgs/${slug}/historial`} className="text-sm text-niebla hover:text-blanco">
          ← {t('back')}
        </Link>
        <h2 className="font-display text-3xl font-extrabold">{results.title}</h2>
        <p className="text-niebla">
          {t('meta', {
            date: format.dateTime(new Date(results.endedAt), { dateStyle: 'full', timeStyle: 'short' }),
            players: t('players', { count: results.playerCount }),
          })}
        </p>
      </div>

      <ResultsTable
        rows={standingsTable(results, locale, (key) => t(key))}
        codes={results.standings.map((s) => ({ rank: s.rank, nickname: s.nickname, code: s.code, score: s.score }))}
        exportBase={`/api/orgs/${slug}/historial/${sessionId}/export?locale=${locale}`}
      />

      {Details && <Details details={results.details} />}
    </div>
  );
}
