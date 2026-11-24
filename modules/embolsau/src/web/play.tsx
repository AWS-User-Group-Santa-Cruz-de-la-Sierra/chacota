'use client';

import { useCountdown } from '@chacota/live/react';
import type { PlayScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Animal, EmbolsauEvent, PlayerSnapshot, RunnerResult } from '../model';
import { simulate, startRunner, type Runner } from '../physics';
import { AnimalPicker } from './animal-picker';
import { initialPhoneState, phoneReducer } from './play-state';
import { ART } from './art';
import { SpeedMeter } from './meter';
import { usePushLoop, type PushBatch } from './use-push-loop';

const never = () => 1;
const FAR = 1e9; // the phone's own runner never "finishes": it only drives the meter

const PUSH_TIMEOUT_MS = 4000;

/** Phone screen while Embolsau runs: pick a critter, then push it with the big button. */
export function EmbolsauPlay({ token, apiUrl, snapshot, clock, playerId, subscribe, setScore }: PlayScreenProps) {
  const t = useTranslations('embolsau.play');
  const [phase, dispatch] = useReducer(phoneReducer, snapshot as Partial<PlayerSnapshot>, initialPhoneState);
  const { animal, inRound, result, lastRank, downUntil } = phase;
  const [speed, setSpeed] = useState(0);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const local = useRef<Runner>(startRunner(phase.raceStartedAt ?? 0));

  useEffect(
    () =>
      subscribe((event) => {
        const e = event as EmbolsauEvent;
        dispatch({ type: 'event', event: e, playerId });
        if (e.type === 'embolsau.phase' && e.phase === 'countdown') local.current = startRunner(e.raceStartedAt ?? clock.now());
        if (e.type === 'embolsau.roundResults' && e.ranks[playerId]) setScore(e.ranks[playerId].total);
      }),
    [subscribe, playerId, setScore, clock],
  );

  // A fall learned from the server: the meter starts over, and the button comes back exactly on time.
  useEffect(() => {
    const wait = downUntil - clock.now();
    if (wait <= 0) return;
    local.current = { ...local.current, speed: 0 };
    setSpeed(0);
    const timer = setTimeout(rerender, wait + 20);
    return () => clearTimeout(timer);
  }, [downUntil, clock]);

  const startsIn = useCountdown(phase.raceStartedAt ?? undefined, clock.now);
  const raceOn =
    inRound &&
    phase.raceStartedAt !== null &&
    (phase.phase === 'racing' || phase.phase === 'closing' || (phase.phase === 'countdown' && startsIn === 0));

  const send = useCallback(
    async (batch: PushBatch) => {
      const res = await fetch(`${apiUrl}/m/embolsau/push`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      });
      if (res.ok) {
        dispatch({ type: 'push', result: (await res.json()) as RunnerResult });
        return;
      }
      if (res.status >= 500) throw new Error('retry');
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      if (error === 'not_in_round') dispatch({ type: 'notInRound' });
    },
    [apiUrl, token],
  );
  const tap = usePushLoop(raceOn, send, clock.now);

  // The meter follows the phone's own taps; the server still decides everything.
  useEffect(() => {
    if (!raceOn || !phase.meter) return;
    const timer = setInterval(() => {
      local.current = simulate(local.current, [], clock.now(), FAR, never);
      setSpeed(local.current.speed);
    }, 100);
    return () => clearInterval(timer);
  }, [raceOn, phase.meter, clock]);

  const push = () => {
    const now = clock.now();
    if (now < downUntil || result?.finished) return;
    tap();
    local.current = simulate(local.current, [now], now + 1, FAR, never);
    setSpeed(local.current.speed);
  };

  async function pick(choice: Animal) {
    dispatch({ type: 'picked', animal: choice });
    await fetch(`${apiUrl}/m/embolsau/pick`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ animal: choice }),
    }).catch(() => null);
  }

  const header = (animal || result?.place != null) && (
    <div className="flex items-center justify-between gap-3">
      {animal ? <img src={ART[animal].icon} alt={t('yourAnimal')} width={56} height={56} /> : <span />}
      {result?.place != null && <p className="font-display text-4xl font-extrabold text-sol">{t('place', { place: result.place })}</p>}
    </div>
  );

  if (phase.phase === 'picking') {
    return (
      <Column>
        <h2 className="text-center font-display text-3xl font-extrabold">{t('pick')}</h2>
        <AnimalPicker selected={animal} onPick={pick} />
        {animal && <p className="text-center text-niebla">{t('picked')}</p>}
      </Column>
    );
  }

  if (phase.phase === 'roundResults') {
    const last = phase.round >= phase.rounds;
    return (
      <Centered>
        {header}
        {lastRank ? (
          <>
            <p className="font-display text-5xl font-extrabold">{t('place', { place: lastRank.place })}</p>
            <p className="text-2xl text-sol">{t('points', { points: lastRank.points })}</p>
            <p className="text-lg text-niebla">{t('total', { total: lastRank.total })}</p>
          </>
        ) : (
          <p className="text-lg text-niebla">{t('nextRound')}</p>
        )}
        <p className="text-niebla">{last ? t('lookAtScreen') : t('getReadyNext')}</p>
      </Centered>
    );
  }

  if (!inRound) {
    return (
      <Centered>
        <p className="font-display text-3xl font-extrabold">{t('lateTitle')}</p>
        <p className="text-lg text-niebla">{t('lateBody')}</p>
      </Centered>
    );
  }

  if (!raceOn) {
    return (
      <Centered>
        {header}
        <p className="font-display text-8xl font-extrabold text-sol" aria-live="assertive">
          {startsIn === null ? '…' : Math.max(1, Math.ceil(startsIn / 1000))}
        </p>
        <p className="text-lg text-niebla">{t('ready')}</p>
      </Centered>
    );
  }

  const down = clock.now() < downUntil;
  return (
    <Column>
      {header}
      {phase.phase === 'closing' && <p className="text-center font-bold text-sol">{t('closing')}</p>}
      {phase.meter && !down && !result?.finished && <SpeedMeter speed={speed} />}
      {result?.finished ? (
        <Centered>
          <p className="font-display text-4xl font-extrabold text-sol">{t('finished')}</p>
          <p className="text-lg text-niebla">{t('lookAtScreen')}</p>
        </Centered>
      ) : (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            push();
          }}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              push();
            }
          }}
          disabled={down}
          className="flex min-h-[50vh] w-full touch-manipulation select-none items-center justify-center rounded-3xl bg-verde font-display text-5xl font-extrabold text-blanco shadow-lg active:scale-[0.98] disabled:bg-noche-3 disabled:text-niebla"
        >
          {down ? t('fallen') : t('push')}
        </button>
      )}
    </Column>
  );
}

function Column({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4">{children}</div>;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">{children}</div>;
}
