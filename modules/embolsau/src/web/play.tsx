'use client';

import { useCountdown } from '@chacota/live/react';
import type { PlayScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Animal, EmbolsauEvent, PhaseInfo, PlayerSnapshot, RoundRank, RunnerResult } from '../model';
import { simulate, startRunner, type Runner } from '../physics';
import { AnimalPicker } from './animal-picker';
import { ART } from './art';
import { SpeedMeter } from './meter';
import { usePushLoop, type PushBatch } from './use-push-loop';

const never = () => 1;
const FAR = 1e9; // the phone's own runner never "finishes": it only drives the meter

/** Phone screen while Embolsau runs: pick a critter, then push it with the big button. */
export function EmbolsauPlay({ token, apiUrl, snapshot, clock, playerId, subscribe, setScore }: PlayScreenProps) {
  const s0 = snapshot as unknown as PlayerSnapshot;
  const t = useTranslations('embolsau.play');
  const [phase, setPhase] = useState<PhaseInfo>(s0);
  const [animal, setAnimal] = useState<Animal | null>(s0.animal);
  const [inRound, setInRound] = useState(s0.inRound || s0.raceStartedAt === null);
  const [result, setResult] = useState<RunnerResult | null>(s0.runner);
  const [lastRank, setLastRank] = useState<RoundRank | undefined>(s0.lastRank);
  const [speed, setSpeed] = useState(0);
  const local = useRef<Runner>(startRunner(s0.raceStartedAt ?? 0));
  const downUntil = useRef(s0.runner?.downUntil ?? 0);

  useEffect(
    () =>
      subscribe((event) => {
        const e = event as EmbolsauEvent;
        if (e.type === 'embolsau.phase') {
          setPhase(e);
          if (e.phase === 'countdown') {
            // A new round: everyone in the session runs it.
            setInRound(true);
            setResult(null);
            downUntil.current = 0;
            local.current = startRunner(e.raceStartedAt ?? clock.now());
          }
        } else if (e.type === 'embolsau.roundResults') {
          const mine = e.ranks[playerId];
          setLastRank(mine);
          if (mine) setScore(mine.total);
        }
      }),
    [subscribe, playerId, setScore, clock],
  );

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
      });
      if (res.ok) {
        const r = (await res.json()) as RunnerResult;
        setResult(r);
        if (r.downUntil > downUntil.current) {
          // The server decided a fall: the meter starts over from zero.
          downUntil.current = r.downUntil;
          local.current = { ...local.current, speed: 0 };
        }
        return;
      }
      if (res.status >= 500) throw new Error('retry');
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      if (error === 'not_in_round') setInRound(false);
    },
    [apiUrl, token],
  );
  const tap = usePushLoop(raceOn, send, clock.now);

  // The meter follows the phone's own taps; the server still decides everything.
  useEffect(() => {
    if (!raceOn || !s0.meter) return;
    const timer = setInterval(() => {
      local.current = simulate(local.current, [], clock.now(), FAR, never);
      setSpeed(local.current.speed);
    }, 100);
    return () => clearInterval(timer);
  }, [raceOn, s0.meter, clock]);

  const push = () => {
    const now = clock.now();
    if (now < downUntil.current || result?.finished) return;
    tap();
    local.current = simulate(local.current, [now], now + 1, FAR, never);
    setSpeed(local.current.speed);
  };

  async function pick(choice: Animal) {
    setAnimal(choice);
    await fetch(`${apiUrl}/m/embolsau/pick`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ animal: choice }),
    }).catch(() => null);
  }

  const header = animal && (
    <div className="flex items-center justify-between gap-3">
      <img src={ART[animal].icon} alt={t('yourAnimal')} width={56} height={56} />
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

  const down = clock.now() < downUntil.current;
  return (
    <Column>
      {header}
      {phase.phase === 'closing' && <p className="text-center font-bold text-sol">{t('closing')}</p>}
      {s0.meter && !down && !result?.finished && <SpeedMeter speed={speed} />}
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
