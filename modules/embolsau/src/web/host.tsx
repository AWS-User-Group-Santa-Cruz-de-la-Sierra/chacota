'use client';

import { useCountdown } from '@chacota/live/react';
import type { HostScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ANIMALS, TRACK_METERS, type Animal, type EmbolsauEvent, type HostSnapshot, type PhaseInfo, type RoundPlace, type RoundRank } from '../model';
import { ART } from './art';
import type { RunnerView } from './camera';
import { drawRace, FRAME, type Sprites } from './race-canvas';

const TICK_MS = 500;
const TICKING = new Set(['picking', 'countdown', 'racing', 'closing']);

type LastRound = { round: number; top: RoundPlace[]; ranks: Record<string, RoundRank> };

/** Presenter screen while Embolsau runs: picking, 3-2-1, the race, and each round's results. */
export function EmbolsauHost({ snapshot, clock, playerCount, subscribe, hostAction, setAdvanceLabel, setSubtitle }: HostScreenProps) {
  const s0 = snapshot as unknown as HostSnapshot;
  const t = useTranslations('embolsau.host');
  const [phase, setPhase] = useState<PhaseInfo>(s0);
  const [picks, setPicks] = useState<{ counts: Record<Animal, number>; picked: number } | null>(null);
  const [lastRound, setLastRound] = useState<LastRound | undefined>(s0.lastRound);
  const runners = useRef<{ prev: RunnerView[]; next: RunnerView[] }>({ prev: [], next: [] });
  const trackMeters = TRACK_METERS[s0.track];

  useEffect(
    () =>
      subscribe((event) => {
        const e = event as EmbolsauEvent;
        if (e.type === 'embolsau.phase') {
          setPhase(e);
          if (e.phase === 'countdown') runners.current = { prev: [], next: [] };
        } else if (e.type === 'embolsau.picks') setPicks(e);
        else if (e.type === 'embolsau.standings') runners.current = { prev: runners.current.next, next: e.runners.map((r) => ({ ...r, at: e.at })) };
        else if (e.type === 'embolsau.roundResults') setLastRound(e);
      }),
    [subscribe],
  );

  // The presenter's screen drives the clock-based phases (see hostActions.tick on the server).
  const ticking = phase.phase !== null && TICKING.has(phase.phase);
  useEffect(() => {
    if (!ticking) return;
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await hostAction('tick');
      } catch {
        // The next tick tries again.
      } finally {
        busy = false;
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [ticking, hostAction]);

  const last = phase.round >= phase.rounds;
  const label =
    phase.phase === 'picking'
      ? t('advance.startNow')
      : phase.phase === 'countdown'
        ? t('advance.starting')
        : phase.phase === 'racing' || phase.phase === 'closing'
          ? t('advance.endRound')
          : last
            ? t('advance.podium')
            : t('advance.nextRound');
  useEffect(() => setAdvanceLabel(label), [label, setAdvanceLabel]);
  const subtitle = phase.round > 0 ? t('subtitle', { round: phase.round, rounds: phase.rounds }) : null;
  useEffect(() => setSubtitle(subtitle), [subtitle, setSubtitle]);

  const left = useCountdown(phase.phaseEndsAt ?? undefined, clock.now);

  if (phase.phase === 'picking' || phase.phase === null) {
    return (
      <Screen>
        <h2 className="font-display text-6xl font-extrabold">{t('phase.picking')}</h2>
        <div className="grid w-full max-w-5xl grid-cols-4 gap-6">
          {ANIMALS.map((animal) => (
            <div key={animal} className="flex flex-col items-center gap-3 rounded-3xl bg-noche-2/80 p-6">
              <img src={ART[animal].icon} alt="" width={160} height={160} />
              <span className="font-display text-3xl font-bold">{t(`animals.${animal}`)}</span>
              <span className="text-4xl font-extrabold text-sol">{picks?.counts[animal] ?? 0}</span>
            </div>
          ))}
        </div>
        <p className="text-2xl text-niebla">
          {t('picked', { picked: picks?.picked ?? 0, total: playerCount })}
          {left !== null && ` · ${t('secondsLeft', { seconds: Math.ceil(left / 1000) })}`}
        </p>
      </Screen>
    );
  }

  if (phase.phase === 'countdown' && left !== null && left > 0) {
    return (
      <Screen>
        <p className="font-display text-[14rem] leading-none font-extrabold text-sol" aria-live="assertive">
          {Math.ceil(left / 1000)}
        </p>
        <p className="text-3xl text-niebla">{t('phase.countdown')}</p>
      </Screen>
    );
  }

  if (phase.phase === 'roundResults') {
    const top = lastRound?.round === phase.round ? lastRound.top : [];
    return (
      <Screen>
        <h2 className="font-display text-5xl font-extrabold">{t('roundTitle', { round: phase.round })}</h2>
        <table className="w-full max-w-4xl text-left text-2xl">
          <thead className="text-niebla">
            <tr>
              <th className="py-2 pr-4 font-medium">#</th>
              <th className="py-2 pr-4 font-medium">{t('table.player')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('table.time')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('table.points')}</th>
              {phase.rounds > 1 && <th className="py-2 text-right font-medium">{t('table.total')}</th>}
            </tr>
          </thead>
          <tbody>
            {top.map((p) => (
              <tr key={p.playerId} className="border-t border-noche-3">
                <td className="py-2 pr-4 font-bold text-sol">{p.place}</td>
                <td className="py-2 pr-4">{p.nickname}</td>
                <td className="py-2 pr-4 text-right">{p.timeMs === null ? t('table.meters', { meters: Math.round(p.meters) }) : t('table.seconds', { seconds: (p.timeMs / 1000).toFixed(1) })}</td>
                <td className="py-2 pr-4 text-right">+{p.points}</td>
                {phase.rounds > 1 && <td className="py-2 text-right font-bold">{lastRound?.ranks[p.playerId]?.total ?? p.points}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </Screen>
    );
  }

  return (
    <RaceView
      runners={runners}
      now={clock.now}
      trackMeters={trackMeters}
      closingEndsAt={phase.phase === 'closing' ? phase.phaseEndsAt : null}
    />
  );
}

function RaceView({
  runners,
  now,
  trackMeters,
  closingEndsAt,
}: {
  runners: React.RefObject<{ prev: RunnerView[]; next: RunnerView[] }>;
  now: () => number;
  trackMeters: number;
  closingEndsAt: number | null;
}) {
  const t = useTranslations('embolsau.host');
  const canvas = useRef<HTMLCanvasElement>(null);
  const closing = useRef(closingEndsAt);
  closing.current = closingEndsAt;
  const labels = useRef({
    behind: (n: number) => t('behind', { count: n }),
    leaders: t('leaders'),
    all: t('everyone'),
    bump: t('bump'),
    closing: (s: number) => t('closingLeft', { seconds: s }),
  });

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const sprites = Object.fromEntries(
      ANIMALS.map((a) => {
        const run = new Image();
        run.src = ART[a].run;
        const down = new Image();
        down.src = ART[a].down;
        return [a, { run, down }];
      }),
    ) as Sprites;
    let frame = 0;
    const camera = { x: 0, at: 0 };
    const draw = () => {
      // Draw at the canvas's real resolution, in the 1280×720 frame's coordinates.
      const ratio = window.devicePixelRatio || 1;
      const cssWidth = el.clientWidth;
      const width = Math.round(cssWidth * ratio);
      const height = Math.round(((cssWidth * FRAME.height) / FRAME.width) * ratio);
      if (el.width !== width || el.height !== height) {
        el.width = width;
        el.height = height;
      }
      ctx.setTransform(width / FRAME.width, 0, 0, height / FRAME.height, 0, 0);
      const at = now();
      drawRace(ctx, {
        prev: runners.current.prev,
        next: runners.current.next,
        camera,
        now: at,
        trackMeters,
        closingLeftMs: closing.current === null ? null : Math.max(0, closing.current - at),
        sprites,
        labels: labels.current,
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [now, runners, trackMeters]);

  return <canvas ref={canvas} className="aspect-video w-full rounded-2xl" aria-label={t('phase.racing')} role="img" />;
}

function Screen({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">{children}</div>;
}
