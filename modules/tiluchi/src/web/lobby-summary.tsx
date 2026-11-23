'use client';

import { useTranslations } from 'next-intl';
import { estimateMinutes } from '../content/estimate';
import type { TiluchiSnapshot } from '../server/model';

/** "12 preguntas · unos 8 minutos" under the title in the lobby. */
export function TiluchiLobbySummary({ snapshot }: { snapshot: Record<string, unknown> }) {
  const t = useTranslations('tiluchi.host');
  const questions = (snapshot as unknown as TiluchiSnapshot).questions ?? [];
  if (questions.length === 0) return null;
  return <>{t('lobbySummary', { count: questions.length, minutes: estimateMinutes(questions) })}</>;
}
