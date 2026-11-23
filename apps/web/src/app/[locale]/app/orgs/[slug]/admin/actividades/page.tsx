import { availableActivities, enabledActivities } from '@chacota/core';
import { getTranslations } from 'next-intl/server';
import { manifests } from '@/activities/registry.server';
import { requireOrgAccess } from '@/lib/auth';
import { ActivitiesForm } from './activities-form';
import { setOrgActivitiesAction } from './actions';

const GUIDE_URL = 'https://github.com/awsugscz/chacota/blob/main/docs/actividades.md';

export default async function ActivitiesAdmin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org } = await requireOrgAccess(slug, 'org.update');
  const t = await getTranslations();
  const enabled = new Set(enabledActivities(org, manifests).map((m) => m.id));
  const options = availableActivities(manifests).map((m) => ({
    id: m.id,
    color: m.color,
    name: t(`${m.id}.card.name`),
    description: t(`${m.id}.card.description`),
    experimental: m.status === 'experimental',
    enabled: enabled.has(m.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-3xl font-extrabold">{t('activitiesAdmin.title')}</h2>
      <p className="max-w-2xl text-niebla">{t('activitiesAdmin.hint')}</p>
      <ActivitiesForm action={setOrgActivitiesAction.bind(null, slug)} options={options} />
      <p className="text-sm text-niebla">
        {t('activitiesAdmin.propose')}{' '}
        <a href={GUIDE_URL} className="font-semibold text-sol hover:underline" target="_blank" rel="noreferrer">
          {t('activitiesAdmin.proposeLink')}
        </a>
      </p>
    </div>
  );
}
