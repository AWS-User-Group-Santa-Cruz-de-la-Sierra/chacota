import { getUsers, listOrgsByStatus } from '@chacota/db';
import { getTranslations } from 'next-intl/server';
import { SubmitButton } from '@/components/submit-button';
import { Card, PageTitle } from '@/components/ui';
import { requireSuperadmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { setOrgStatusAction } from '../actions';

export default async function Admin() {
  await requireSuperadmin();
  const t = await getTranslations('admin');
  const pending = await listOrgsByStatus(getDb(), 'pending');
  const creators = await getUsers(getDb(), pending.map((o) => o.createdBy));

  return (
    <>
      <PageTitle>{t('title')}</PageTitle>
      {pending.length === 0 ? (
        <Card>
          <p className="text-niebla">{t('empty')}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((org) => (
            <li key={org.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-display text-xl font-bold">{org.name}</span>
                  <span className="text-sm text-niebla">
                    /{org.slug} · {creators.get(org.createdBy)?.email ?? org.createdBy}
                  </span>
                  {org.description && <span className="mt-1 text-sm">{org.description}</span>}
                </div>
                <div className="flex gap-2">
                  <form action={setOrgStatusAction}>
                    <input type="hidden" name="orgId" value={org.id} />
                    <input type="hidden" name="status" value="active" />
                    <SubmitButton>{t('approve')}</SubmitButton>
                  </form>
                  <form action={setOrgStatusAction}>
                    <input type="hidden" name="orgId" value={org.id} />
                    <input type="hidden" name="status" value="suspended" />
                    <SubmitButton variant="danger">{t('suspend')}</SubmitButton>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
