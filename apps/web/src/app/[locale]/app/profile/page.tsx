import { getTranslations } from 'next-intl/server';
import { PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { updateProfileAction } from '../actions';
import { ProfileForm } from './profile-form';

export default async function Profile() {
  const user = await requireUser();
  const t = await getTranslations('profile');
  return (
    <>
      <PageTitle>{t('title')}</PageTitle>
      <ProfileForm action={updateProfileAction} name={user.name} email={user.email} builderProfileUrl={user.builderProfileUrl} />
    </>
  );
}
