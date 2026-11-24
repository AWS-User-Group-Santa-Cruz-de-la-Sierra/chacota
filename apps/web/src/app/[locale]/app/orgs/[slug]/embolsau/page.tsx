import { can } from '@chacota/core';
import { getTranslations } from 'next-intl/server';
import { BackLink } from '@/components/back-link';
import { Card } from '@/components/ui';
import { requireOrgAccess } from '@/lib/auth';
import { requireActivity } from '@/lib/require-activity';
import { NewRaceForm } from './new-race-form';

export default async function EmbolsauPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrgAccess(slug);
  requireActivity(org, 'embolsau');
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <BackLink href={`/app/orgs/${slug}`}>{t('org.activities')}</BackLink>
        <h2 className="font-display text-3xl font-extrabold">{t('embolsau.card.name')}</h2>
        <p className="text-niebla">{t('embolsau.card.description')}</p>
      </div>
      {can(role, 'activity.host') ? (
        <Card>
          <NewRaceForm slug={slug} />
        </Card>
      ) : (
        <p className="text-niebla">{t('embolsau.form.hostOnly')}</p>
      )}
    </div>
  );
}
