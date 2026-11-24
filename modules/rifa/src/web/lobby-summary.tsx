'use client';

import { useTranslations } from 'next-intl';
import type { HostSnapshot } from '../model';

/** "Se anotan con el QR · 2 al agua por ronda" under the title in the lobby. */
export function RifaLobbySummary({ snapshot }: { snapshot: Record<string, unknown> }) {
  const t = useTranslations('rifa.host.lobbySummary');
  const s = snapshot as unknown as Partial<HostSnapshot>;
  if (s.overboard === undefined) return null;
  return <>{s.mode === 'list' ? t('list', { count: s.entries?.length ?? 0, overboard: s.overboard }) : t('qr', { overboard: s.overboard })}</>;
}
