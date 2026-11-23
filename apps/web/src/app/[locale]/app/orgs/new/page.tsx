import { getTranslations } from 'next-intl/server';
import { PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { createOrgAction } from '../../actions';
import { OrgForm } from '../org-form';

export default async function NewOrg() {
  const user = await requireUser();
  const t = await getTranslations('orgForm');
  return (
    <>
      <PageTitle>{t('title')}</PageTitle>
      <OrgForm action={createOrgAction} mode="create" showPendingNotice={!user.isSuperadmin && !env.autoApproveOrgs} />
    </>
  );
}
