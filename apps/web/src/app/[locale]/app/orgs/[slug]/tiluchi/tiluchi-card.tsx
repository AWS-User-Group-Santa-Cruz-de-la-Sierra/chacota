'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { buttonClass } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { startTiluchiAction } from '@/app/[locale]/host/actions';
import { deleteTiluchiFromListAction, duplicateTiluchiAction } from './actions';

interface Props {
  slug: string;
  id: string;
  title: string;
  meta: string;
  canHost: boolean;
  canEdit: boolean;
}

/** A tiluchi in the list: open it, or present, duplicate or delete it right from here. */
export function TiluchiCard({ slug, id, title, meta, canHost, canEdit }: Props) {
  const t = useTranslations('tiluchiList');
  const th = useTranslations('host');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const present = () =>
    startTransition(async () => {
      setError(null);
      const result = await startTiluchiAction(slug, id);
      if (result?.error) setError(th(result.error === 'org_not_active' ? 'orgNotActive' : result.error === 'activity_disabled' ? 'activityDisabled' : 'notPlayable'));
    });

  return (
    <article data-tiluchi={id} className="flex h-full flex-col rounded-2xl border border-noche-3 bg-noche-2/60 transition-colors hover:border-morado-claro">
      <Link href={`/app/orgs/${slug}/tiluchi/${id}`} className="flex flex-1 flex-col gap-2 p-5">
        <span className="font-display text-xl font-bold">{title}</span>
        <span className="text-sm text-niebla">{meta}</span>
      </Link>
      {error && (
        <p role="alert" className="mx-5 mb-3 rounded-xl bg-tajibo/20 px-3 py-2 text-sm text-[#ff9cc0]">
          {error}
        </p>
      )}
      {(canHost || canEdit) && (
        <div className="flex flex-wrap items-center gap-1 border-t border-noche-3 px-3 py-2" role="toolbar" aria-label={title}>
          {canHost && (
            <button type="button" onClick={present} disabled={pending} className={buttonClass('primary', 'min-h-9 px-3 text-sm')}>
              ▶ {th('present')}
            </button>
          )}
          {canEdit && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => duplicateTiluchiAction(slug, id))}
                className={buttonClass('ghost', 'min-h-9 px-3 text-sm')}
              >
                {t('duplicate')}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm(t('confirmDelete', { title })) && startTransition(() => deleteTiluchiFromListAction(slug, id))}
                className="ml-auto inline-flex min-h-9 items-center rounded-xl px-3 text-sm font-semibold text-[#ff9cc0] transition-colors hover:bg-tajibo/15 disabled:opacity-60"
              >
                {t('delete')}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
