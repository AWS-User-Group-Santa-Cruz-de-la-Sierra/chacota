'use client';

import type { PlayScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';

/** Phone screen while the race runs (filled in by the phone view). */
export function EmbolsauPlay({ snapshot }: PlayScreenProps) {
  const t = useTranslations('embolsau.host');
  return <p className="text-center text-xl">{t(`phase.${String(snapshot.phase ?? 'picking')}`)}</p>;
}
