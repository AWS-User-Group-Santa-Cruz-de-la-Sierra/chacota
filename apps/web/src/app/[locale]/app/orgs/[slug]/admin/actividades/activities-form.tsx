'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { Badge } from '@/components/ui';

interface Option {
  id: string;
  color: string;
  name: string;
  description: string;
  experimental: boolean;
  enabled: boolean;
}

export function ActivitiesForm({
  action,
  options,
}: {
  action: (state: { saved?: boolean }, form: FormData) => Promise<{ saved?: boolean }>;
  options: Option[];
}) {
  const t = useTranslations('activitiesAdmin');
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {options.map((o) => (
          <li key={o.id}>
            <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-noche-3 bg-noche-2/60 p-4 has-checked:border-morado-claro">
              <input type="checkbox" name="activity" value={o.id} defaultChecked={o.enabled} className="h-5 w-5 accent-morado" />
              <span className="h-10 w-10 shrink-0 rounded-xl" style={{ background: o.color }} aria-hidden="true" />
              <span className="flex flex-1 flex-col">
                <span className="flex items-center gap-2 font-semibold">
                  {o.name}
                  {o.experimental && <Badge tone="sol">{t('experimental')}</Badge>}
                </span>
                <span className="text-sm text-niebla">{o.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <SubmitButton>{t('save')}</SubmitButton>
        {state.saved && <span className="text-verde" role="status">{t('saved')}</span>}
      </div>
    </form>
  );
}
