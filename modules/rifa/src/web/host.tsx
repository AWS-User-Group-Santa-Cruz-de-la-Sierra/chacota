'use client';

import type { HostScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import type { HostSnapshot } from '../model';

/** Minimal presenter screen: the bag and each entry's status. Replaced by the real screen later. */
export function RifaHost({ snapshot }: HostScreenProps) {
  const s = snapshot as unknown as HostSnapshot;
  const t = useTranslations('rifa.host');
  return (
    <div className="flex flex-col gap-3 p-6">
      <h2 className="font-display text-2xl font-bold">{t('bag')}</h2>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {(s.entries ?? []).map((e) => (
          <li key={e.id} className="flex justify-between gap-2">
            <span>{e.name}</span>
            <span className="text-niebla">{t(`status.${e.status}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
