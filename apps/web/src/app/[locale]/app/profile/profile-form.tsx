'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { Field, Notice } from '@/components/ui';
import type { FormState } from '../actions';

export function ProfileForm({
  action,
  name,
  email,
  builderProfileUrl,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  name: string;
  email: string;
  builderProfileUrl?: string;
}) {
  const t = useTranslations();
  const [state, formAction] = useActionState(action, {});
  const err = (f: string) => (state.fieldErrors?.[f] ? t('common.invalidField') : undefined);
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {state.ok && <Notice>{t('profile.saved')}</Notice>}
      <Field label={t('profile.name')} name="name" required defaultValue={name} error={err('name')} />
      <Field label={t('profile.email')} name="email" defaultValue={email} disabled />
      <Field
        label={t('profile.builder')}
        name="builderProfileUrl"
        type="url"
        defaultValue={builderProfileUrl}
        hint={t('profile.builderHint')}
        error={err('builderProfileUrl')}
      />
      <div>
        <SubmitButton pendingLabel={t('common.saving')}>{t('common.save')}</SubmitButton>
      </div>
    </form>
  );
}
