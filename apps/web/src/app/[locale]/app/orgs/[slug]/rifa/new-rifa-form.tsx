'use client';

import { DEFAULT_OVERBOARD, duplicateNames, MAX_NAMES, MAX_OVERBOARD, MIN_NAMES, NAME_MAX, parseNames, type Mode, type RifaConfig } from '@chacota/rifa/model';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { buttonClass, Field, Select } from '@/components/ui';
import { startRifaAction } from './actions';

/** How many of the too-long names the form lists, and how much of each it shows. */
const LONG_SHOWN = 3;
const LONG_CUT = NAME_MAX + 10;
const cut = (name: string) => {
  const chars = [...name];
  return chars.length > LONG_CUT ? `${chars.slice(0, LONG_CUT - 1).join('')}…` : name;
};

/** "Nueva rifa": name, how people sign up, how many go overboard per round, then straight to the presenter's screen. */
export function NewRifaForm({ slug }: { slug: string }) {
  const t = useTranslations('rifa.form');
  const th = useTranslations('host');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [text, setText] = useState('');
  const names = parseNames(text);
  const repeated = duplicateNames(names);
  const tooFew = mode === 'list' && names.length < MIN_NAMES;
  const tooMany = mode === 'list' && names.length > MAX_NAMES;
  // `.length`, the same count the server checks.
  const tooLong = mode === 'list' ? names.filter((n) => n.length > NAME_MAX) : [];
  const longShown = tooLong.slice(0, LONG_SHOWN).map((n) => `“${cut(n)}”`).join(', ') + (tooLong.length > LONG_SHOWN ? ', …' : '');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const config: RifaConfig = {
          mode,
          overboard: Number(form.get('overboard')),
          title: String(form.get('title') ?? ''),
          ...(mode === 'list' ? { names } : {}),
        };
        startTransition(async () => {
          setError(null);
          const result = await startRifaAction(slug, config);
          if (result?.error) setError(result.error === 'org_not_active' ? th('orgNotActive') : result.error === 'activity_disabled' ? th('activityDisabled') : t('invalid'));
        });
      }}
    >
      <h3 className="font-display text-xl font-bold">{t('title')}</h3>
      <Field label={t('name')} name="title" defaultValue={t('defaultName')} maxLength={80} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t('mode')}</legend>
        {(['list', 'qr'] as const).map((m) => (
          <label key={m} className="flex min-h-11 items-center gap-2">
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
            {t(`modes.${m}`)}
          </label>
        ))}
      </fieldset>
      <Select label={t('overboard')} name="overboard" defaultValue={String(DEFAULT_OVERBOARD)}>
        {Array.from({ length: MAX_OVERBOARD + 1 }, (_, n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
      {mode === 'list' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="names" className="text-sm font-medium">
            {t('names')}
          </label>
          <textarea
            id="names"
            name="names"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-xl border border-noche-3 bg-noche px-3 py-2 text-blanco placeholder:text-niebla/60 focus:border-morado-claro focus:outline-none"
          />
          <div className="flex flex-col gap-1.5 text-sm" aria-live="polite">
            <p className="text-niebla">
              {t('count', { count: names.length })}
              {tooFew && ` ${t('min', { min: MIN_NAMES })}`}
            </p>
            {tooMany && <p className="text-[#ff9cc0]">{t('tooMany', { max: MAX_NAMES })}</p>}
            {tooLong.length > 0 && (
              <p className="break-words text-[#ff9cc0]">{t('tooLong', { count: tooLong.length, max: NAME_MAX, names: longShown })}</p>
            )}
            {repeated.length > 0 && <p className="text-sol">{t('duplicates')}</p>}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-tajibo/20 px-3 py-2 text-sm text-[#ff9cc0]">
          {error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending || tooFew || tooMany || tooLong.length > 0} className={buttonClass('primary')}>
          ▶ {pending ? t('starting') : t('start')}
        </button>
      </div>
    </form>
  );
}
