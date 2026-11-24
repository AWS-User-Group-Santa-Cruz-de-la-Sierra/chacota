'use client';

import { useTranslations } from 'next-intl';
import { PHYSICS, zone } from '../physics';

const ZONES = [
  { key: 'green', className: 'bg-verde' },
  { key: 'yellow', className: 'bg-sol' },
  { key: 'red', className: 'bg-tajibo' },
] as const;

/** Speed meter: three zones with words, not only colors. */
export function SpeedMeter({ speed }: { speed: number }) {
  const t = useTranslations('embolsau.play.meter');
  const current = zone(speed);
  const max = PHYSICS.redSpeed * 1.4;
  const fill = Math.min(1, speed / max);
  return (
    <div className="flex flex-col gap-2" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(speed)} aria-label={t('label')}>
      <div className="relative h-5 overflow-hidden rounded-full bg-noche-3">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ${ZONES.find((z) => z.key === current)!.className}`}
          style={{ width: `${fill * 100}%` }}
        />
        <div className="absolute inset-y-0 border-l-2 border-blanco/70" style={{ left: `${(PHYSICS.safeSpeed / max) * 100}%` }} />
        <div className="absolute inset-y-0 border-l-2 border-blanco/70" style={{ left: `${(PHYSICS.redSpeed / max) * 100}%` }} />
      </div>
      <p className="text-center text-lg font-bold" aria-live="polite">
        {t(current)}
      </p>
    </div>
  );
}
