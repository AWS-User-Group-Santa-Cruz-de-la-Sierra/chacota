'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { Field, Select } from '@/components/ui';
import type { FormState } from '../../actions';

export function NewTiluchiForm({ action }: { action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const t = useTranslations();
  const locale = useLocale();
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <Field
          label={t('org.tiluchiTitle')}
          name="title"
          required
          maxLength={120}
          error={state.fieldErrors?.title ? t('common.invalidField') : undefined}
        />
      </div>
      <div className="w-40">
        <Select label={t('org.tiluchiLanguage')} name="language" defaultValue={locale}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </Select>
      </div>
      <SubmitButton pendingLabel={t('common.saving')}>{t('org.newTiluchi')}</SubmitButton>
    </form>
  );
}
