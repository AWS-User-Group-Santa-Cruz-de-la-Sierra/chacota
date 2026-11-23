import { can } from '@chacota/core';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { Link } from '@/i18n/navigation';
import { requireOrgAccess } from '@/lib/auth';
import { getGameService } from '@/lib/game';
import { finishGameAction } from './actions';

export default async function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrgAccess(slug);
  const t = await getTranslations('results');
  const format = await getFormatter();
  const service = getGameService();
  const [results, unfinished] = await Promise.all([service.listResults(org.id), service.listUnfinishedGames(org.id)]);

  return (
    <div className="flex flex-col gap-6">
      {unfinished.length > 0 && can(role, 'activity.host') && (
        <Card className="flex flex-col gap-3 border-sol/40">
          <h2 className="font-display text-xl font-bold">{t('unfinished')}</h2>
          <p className="text-sm text-niebla">{t('unfinishedHint')}</p>
          <ul className="flex flex-col gap-2">
            {unfinished.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{g.title}</span>{' '}
                  <span className="text-sm text-niebla">
                    · {format.dateTime(new Date(g.createdAt), { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                    {t('players', { count: g.playerCount })}
                  </span>
                </span>
                <form action={finishGameAction.bind(null, g.id)}>
                  <SubmitButton variant="secondary">{t('finishAndSave')}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {results.length === 0 ? (
        <p className="text-niebla">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((r) => (
            <li key={r.gameId}>
              <Link
                href={`/app/orgs/${slug}/results/${r.gameId}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-noche-3 bg-noche-2/60 p-5 transition-colors hover:border-morado-claro"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-display text-xl font-bold">{r.title}</span>
                  <span className="text-sm text-niebla">
                    {t('meta', {
                      date: format.dateTime(new Date(r.endedAt), { dateStyle: 'medium', timeStyle: 'short' }),
                      players: t('players', { count: r.playerCount }),
                      questions: t('questionsPlayed', { played: r.questionsPlayed, total: r.questionCount }),
                    })}
                  </span>
                </span>
                <ol className="flex flex-wrap gap-2 text-sm">
                  {r.podium.map((p, i) => (
                    <li key={i} className="rounded-full bg-noche px-3 py-1">
                      <span className={['text-sol', 'text-morado-claro', 'text-tajibo'][i]}>{i + 1}.</span> {p.nickname}
                    </li>
                  ))}
                </ol>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
