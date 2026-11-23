'use client';

import { MAX_PLAYERS, TRACKS, type EmbolsauConfig, type Track } from '@chacota/embolsau/model';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { buttonClass, Field, Select } from '@/components/ui';
import { startEmbolsauAction } from './actions';

/** "Nueva carrera": the options of one race session, then straight to the presenter's screen. */
export function NewRaceForm({ slug }: { slug: string }) {
  const t = useTranslations('embolsau.form');
  const th = useTranslations('host');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const config: EmbolsauConfig = {
          meter: form.get('meter') === 'on',
          track: form.get('track') as Track,
          rounds: Number(form.get('rounds')) as EmbolsauConfig['rounds'],
          maxPlayers: Number(form.get('maxPlayers')),
        };
        startTransition(async () => {
          setError(null);
          const result = await startEmbolsauAction(slug, config);
          if (result?.error) setError(th(result.error === 'org_not_active' ? 'orgNotActive' : result.error === 'activity_disabled' ? 'activityDisabled' : 'invalidOptions'));
        });
      }}
    >
      <h3 className="font-display text-xl font-bold">{t('title')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('meter')} name="meter" defaultValue="on">
          <option value="on">{t('meterOn')}</option>
          <option value="off">{t('meterOff')}</option>
        </Select>
        <Select label={t('track')} name="track" defaultValue="normal">
          {TRACKS.map((track) => (
            <option key={track} value={track}>
              {t(`tracks.${track}`)}
            </option>
          ))}
        </Select>
        <Select label={t('rounds')} name="rounds" defaultValue="1">
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {t('roundsValue', { n })}
            </option>
          ))}
        </Select>
        <Field label={t('maxPlayers')} hint={t('maxPlayersHint')} name="maxPlayers" type="number" min={1} max={MAX_PLAYERS} defaultValue={MAX_PLAYERS} required />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-tajibo/20 px-3 py-2 text-sm text-[#ff9cc0]">
          {error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className={buttonClass('primary')}>
          ▶ {pending ? t('starting') : t('start')}
        </button>
      </div>
    </form>
  );
}
