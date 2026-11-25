'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import type { OnOverboard } from '../model';

const CHOICES: OnOverboard[] = ['discard', 'return'];

/** Under the bag: the hint, "↺ Reiniciar", and what happens to the ones that go overboard. */
export function Controls({
  onOverboard,
  onOverboardChange,
  onReset,
  resetDisabled,
  failed,
}: {
  onOverboard: OnOverboard;
  onOverboardChange(value: OnOverboard): void;
  onReset(): void;
  resetDisabled: boolean;
  failed: boolean;
}) {
  const t = useTranslations('rifa.host');
  const label = useId();
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-niebla">{t('hint')}</p>
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-noche-3 px-4 font-semibold text-niebla transition-colors hover:bg-noche-2 hover:text-blanco disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true">↺</span>
          {t('resetButton')}
        </button>
      </div>
      <div role="group" aria-labelledby={label} className="flex flex-wrap items-center gap-2">
        <span id={label} className="text-niebla">
          {t('onOverboard.label')}
        </span>
        <div className="inline-flex gap-1 rounded-xl bg-noche-2 p-1">
          {CHOICES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={onOverboard === value}
              onClick={() => onOverboard !== value && onOverboardChange(value)}
              className={`min-h-11 rounded-lg px-3 font-semibold transition-colors ${onOverboard === value ? 'bg-morado text-blanco' : 'text-niebla hover:text-blanco'}`}
            >
              {t(`onOverboard.${value}`)}
            </button>
          ))}
        </div>
      </div>
      {failed && (
        <p role="alert" className="basis-full text-sm text-[#ff9cc0]">
          {t('actionFailed')}
        </p>
      )}
    </div>
  );
}
