'use client';

import type { PlayScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import type { PlayerSnapshot } from '../model';

/** Minimal phone screen: the player's status. Replaced by the real screen later. */
export function RifaPlay({ snapshot }: PlayScreenProps) {
  const s = snapshot as unknown as PlayerSnapshot;
  const t = useTranslations('rifa.play');
  return <p className="p-6 text-center font-display text-2xl font-bold">{t(`status.${s.status}`)}</p>;
}
