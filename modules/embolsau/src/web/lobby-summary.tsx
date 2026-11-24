'use client';

import { useTranslations } from 'next-intl';
import type { HostSnapshot } from '../model';

/** "2 carreras · pista normal · con medidor" under the title in the lobby. */
export function EmbolsauLobbySummary({ snapshot }: { snapshot: Record<string, unknown> }) {
  const t = useTranslations('embolsau.host');
  const s = snapshot as unknown as Partial<HostSnapshot>;
  if (!s.config) return null;
  return <>{t('lobbySummary', { rounds: s.config.rounds, track: t(`tracks.${s.config.track}`), meter: t(s.config.meter ? 'withMeter' : 'blind') })}</>;
}
