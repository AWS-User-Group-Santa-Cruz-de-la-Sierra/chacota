'use client';

import { slugify } from '@chacota/core';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { ImagePicker } from '@/components/image-picker';
import { SubmitButton } from '@/components/submit-button';
import { Field, Notice } from '@/components/ui';
import type { FormState } from '../actions';

interface Defaults {
  name?: string;
  slug?: string;
  description?: string;
  primaryColor?: string;
  websiteUrl?: string;
  logoKey?: string;
}

export function OrgForm({
  action,
  defaults = {},
  mode,
  showPendingNotice = false,
  mediaBaseUrl,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  defaults?: Defaults;
  mode: 'create' | 'edit';
  showPendingNotice?: boolean;
  /** Edit mode only: enables the logo. */
  mediaBaseUrl?: string;
}) {
  const t = useTranslations();
  const [state, formAction] = useActionState(action, {});
  const [name, setName] = useState(defaults.name ?? '');
  const [slug, setSlug] = useState(defaults.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [logoKey, setLogoKey] = useState(defaults.logoKey ?? '');
  const err = (field: string) => {
    const e = state.fieldErrors?.[field];
    if (!e) return undefined;
    return e === 'slugTaken' ? t('orgForm.slugTaken') : t('common.invalidField');
  };

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {state.error === 'invalid' && <Notice>{t('orgForm.invalid')}</Notice>}
      {state.ok && <Notice>{t('profile.saved')}</Notice>}
      <Field
        label={t('orgForm.name')}
        name="name"
        required
        placeholder={t('orgForm.namePlaceholder')}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
        error={err('name')}
      />
      {mode === 'create' && (
        <Field
          label={t('orgForm.slug')}
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          hint={t('orgForm.slugHint')}
          error={err('slug')}
        />
      )}
      <Field label={t('orgForm.description')} name="description" defaultValue={defaults.description} error={err('description')} />
      {mode === 'edit' && mediaBaseUrl && (
        <>
          <input type="hidden" name="logoKey" value={logoKey} />
          <ImagePicker
            label={t('orgForm.logo')}
            hint={err('logoKey') ?? t('orgForm.logoHint')}
            value={logoKey || undefined}
            slug={slug}
            purpose="logo"
            maxSide={512}
            mediaBaseUrl={mediaBaseUrl}
            onChange={(key) => setLogoKey(key ?? '')}
          />
        </>
      )}
      <div className="flex flex-wrap gap-5">
        <div className="w-40">
          <Field
            label={t('orgForm.primaryColor')}
            name="primaryColor"
            type="color"
            defaultValue={defaults.primaryColor ?? '#6B2FD6'}
            className="h-11 w-full cursor-pointer rounded-xl border border-noche-3 bg-noche"
          />
        </div>
        <div className="min-w-60 flex-1">
          <Field label={t('orgForm.websiteUrl')} name="websiteUrl" type="url" defaultValue={defaults.websiteUrl} error={err('websiteUrl')} />
        </div>
      </div>
      <p className="-mt-3 text-sm text-niebla">{t('orgForm.primaryColorHint')}</p>
      {showPendingNotice && <Notice>{t('orgForm.pendingNotice')}</Notice>}
      <div>
        <SubmitButton pendingLabel={t('common.saving')}>{mode === 'create' ? t('common.create') : t('common.save')}</SubmitButton>
      </div>
    </form>
  );
}
