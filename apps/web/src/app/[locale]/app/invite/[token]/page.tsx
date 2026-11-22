import { getInvite, getOrg } from '@chacota/db';
import { getTranslations } from 'next-intl/server';
import { SubmitButton } from '@/components/submit-button';
import { Card } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { acceptInviteAction } from '../../actions';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await requireUser();
  const t = await getTranslations();
  const invite = await getInvite(getDb(), token);
  const org = invite && (await getOrg(getDb(), invite.orgId));

  if (!invite || !org) {
    return (
      <Card>
        <p>{t('invite.invalid')}</p>
      </Card>
    );
  }
  return (
    <Card className="flex max-w-xl flex-col gap-4">
      <h1 className="font-display text-3xl font-bold">{t('invite.title', { org: org.name })}</h1>
      <p className="text-niebla">{t('invite.body', { role: t(`roles.${invite.role}`) })}</p>
      <form action={acceptInviteAction.bind(null, token)}>
        <SubmitButton pendingLabel={t('common.saving')}>{t('invite.accept')}</SubmitButton>
      </form>
    </Card>
  );
}
