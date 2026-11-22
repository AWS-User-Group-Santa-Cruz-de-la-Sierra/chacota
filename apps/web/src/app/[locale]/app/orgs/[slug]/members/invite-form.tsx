'use client';

import type { Role } from '@chacota/core';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { Select } from '@/components/ui';
import type { FormState } from '../../../actions';

export function InviteForm({
  action,
  roles,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  roles: Role[];
}) {
  const t = useTranslations();
  const [state, formAction] = useActionState(action, {});
  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select label={t('members.inviteRole')} name="role" defaultValue="editor">
            {roles.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton pendingLabel={t('common.saving')}>{t('members.createInvite')}</SubmitButton>
      </form>
      {state.value && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-niebla">{t('members.inviteLink')}</p>
          <input
            readOnly
            value={state.value}
            aria-label={t('members.inviteLink')}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-full rounded-xl border border-sol/40 bg-noche px-3 font-mono text-sm text-sol"
          />
        </div>
      )}
    </div>
  );
}
