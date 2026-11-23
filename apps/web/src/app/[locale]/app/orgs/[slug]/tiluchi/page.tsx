import { can } from '@chacota/core';
import { listTiluchis } from '@chacota/tiluchi/content';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui';
import { BackLink } from '@/components/back-link';
import { requireOrgAccess } from '@/lib/auth';
import { requireActivity } from '@/lib/require-activity';
import { getDb } from '@/lib/db';
import { createTiluchiAction } from '@/app/[locale]/app/actions';
import { NewTiluchiForm } from './new-tiluchi-form';
import { TiluchiCard } from './tiluchi-card';

export default async function TiluchiList({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrgAccess(slug);
  requireActivity(org, 'tiluchi');
  const t = await getTranslations('org');
  const format = await getFormatter();
  const tiluchis = await listTiluchis(getDb(), org.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <BackLink href={`/app/orgs/${slug}`}>{t('activities')}</BackLink>
        <h2 className="font-display text-3xl font-extrabold">Tiluchi</h2>
      </div>
      {can(role, 'activity.content') && (
        <Card>
          <NewTiluchiForm action={createTiluchiAction.bind(null, slug)} />
        </Card>
      )}
      {tiluchis.length === 0 ? (
        <p className="text-niebla">{t('noTiluchis')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiluchis.map((tl) => (
            <li key={tl.id}>
              <TiluchiCard
                slug={slug}
                id={tl.id}
                title={tl.title}
                meta={`${t('questions', { count: tl.questionCount })} · ${tl.language.toUpperCase()} · ${t('updated', { date: format.relativeTime(new Date(tl.updatedAt)) })}`}
                canHost={can(role, 'activity.host')}
                canEdit={can(role, 'activity.content')}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
