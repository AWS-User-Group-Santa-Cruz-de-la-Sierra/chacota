'use client';

import type { HostScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';

/** Presenter screen while the race runs (filled in by the race view). */
export function EmbolsauHost({ snapshot }: HostScreenProps) {
  const t = useTranslations('embolsau.host');
  return <p className="text-center text-2xl">{t(`phase.${String(snapshot.phase ?? 'picking')}`)}</p>;
}
