import { listOrgsForUser } from '@chacota/db';
import { getTranslations } from 'next-intl/server';
import { Badge, buttonClass, Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { OrgAvatar } from '@/components/org-avatar';
import { env } from '@/lib/env';

export default async function Dashboard() {
  const user = await requireUser();
  const t = await getTranslations();
  const orgs = await listOrgsForUser(getDb(), user.id);

  return (
    <>
      <PageTitle
        actions={
          <Link href="/app/orgs/new" className={buttonClass('primary')}>
            {t('dashboard.newOrg')}
          </Link>
        }
      >
        {t('dashboard.title')}
      </PageTitle>

      {orgs.length === 0 ? (
        <Card>
          <p className="text-lg">{t('dashboard.empty')}</p>
          <p className="mt-1 text-niebla">{t('dashboard.emptyHint')}</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map(({ org, role }) => (
            <li key={org.id}>
              <Link
                href={`/app/orgs/${org.slug}`}
                className="flex h-full flex-col gap-3 rounded-2xl border border-noche-3 bg-noche-2/60 p-5 transition-colors hover:border-morado-claro"
              >
                <span className="flex items-center gap-3">
                  <OrgAvatar name={org.name} logoKey={org.logoKey} primaryColor={org.primaryColor} mediaBaseUrl={env.media.publicUrl} />
                  <span className="font-display text-xl font-bold leading-tight">{org.name}</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <Badge>{t(`roles.${role}`)}</Badge>
                  {org.status === 'pending' && <Badge tone="sol">{t('dashboard.pending')}</Badge>}
                  {org.status === 'suspended' && <Badge tone="tajibo">{t('dashboard.suspended')}</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
