'use client';

import type { PlayScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import type { PlayerSnapshot, RifaEvent, Round } from '../model';
import { stepAt } from '../timeline';
import { Flood } from './flood';
import { nextBoundary } from './host-state';
import { RifaIcon } from './icon';
import { applyPhoneEvent, initialPhoneData, phoneView, revealedWins, revealOf, type PhoneData, type PhoneView } from './phone-state';
import { ScenePlayer } from './scene-player';
import { WinnerPhone } from './winner-phone';

type Action = { playerId: string; event: RifaEvent };
const reduce = (d: PhoneData, a: Action): PhoneData => applyPhoneEvent(d, a.playerId, a.event);

/** What a screen reader hears for the view on screen now; `idle` is the idle screen's title. */
function useAnnouncement(view: PhoneView, round: Round | null, now: number, idle: string): string {
  const t = useTranslations('rifa.play');
  if (view.kind === 'flood') return `${t('flood.title')}. ${t(`flood.${view.onOverboard}`)}`;
  if (view.kind === 'won') return t('won.announce', { round: view.round });
  if (view.kind === 'idle' || !round) return idle;
  const step = stepAt(round, now);
  if (step.kind === 'out') return t('announce.out', { name: round.out[step.index]!.name });
  if (step.kind === 'winner') return t('announce.winner', { name: round.winner.name });
  return t('round', { round: round.n });
}

/**
 * The phone in QR mode. Out of a round it shows where the player stands; during one it plays the
 * same scenes as the big screen, until the player's own result is revealed: the one who goes
 * overboard floods after their scene, the winner lights up from the winner step.
 */
export function RifaPlay({ playerId, snapshot, clock, subscribe, setScore }: PlayScreenProps) {
  const t = useTranslations('rifa.play');
  const [data, dispatch] = useReducer(reduce, snapshot as Partial<PlayerSnapshot>, initialPhoneData);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  // The hub replays its buffer on every subscribe: each event once.
  const seen = useRef(new WeakSet<object>());
  useEffect(
    () =>
      subscribe((event) => {
        const e = event as RifaEvent;
        if ((e.type !== 'rifa.round' && e.type !== 'rifa.bag') || seen.current.has(e)) return;
        seen.current.add(e);
        dispatch({ playerId, event: e });
      }),
    [subscribe, playerId],
  );

  const { status, round } = data;
  const now = clock.now();
  const view = phoneView(playerId, status, round, now);
  const wins = revealedWins(data.wins, round, now);
  const lastWin = wins[wins.length - 1];
  const idleTitle = status !== 'won' ? t(`idle.${status}`) : lastWin === undefined ? t('won.title') : t('idle.won', { round: lastWin });
  const announce = useAnnouncement(view, round, now, idleTitle);

  // The frame's header shows the server's score, which already counts a win not revealed yet.
  // Before paint, so the header never flashes it.
  const score = wins.length;
  useLayoutEffect(() => setScore(score), [score, setScore]);

  // Re-render when a step starts or is revealed, and when the round ends.
  useEffect(() => {
    const at = clock.now();
    const next = nextBoundary(round, at);
    if (next === undefined) return;
    const timer = setTimeout(rerender, next - at + 20);
    return () => clearTimeout(timer);
  });

  let body;
  const mine = round?.out.find((o) => o.entryId === playerId);
  if (view.kind === 'flood' && round && mine) {
    body = <Flood key={round.n} name={mine.name} onOverboard={view.onOverboard} since={revealOf(mine)} clock={clock} />;
  } else if (view.kind === 'won' && round) {
    body = <WinnerPhone key={round.n} name={round.winner.name} since={round.winner.startsAt} clock={clock} />;
  } else if (view.kind === 'scene' && round) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p aria-hidden="true" className="rounded-full bg-noche-2 px-4 py-1 font-display text-lg font-bold">
          {t('round', { round: round.n })}
        </p>
        <div className="w-full">
          <ScenePlayer key={round.n} round={round} clock={clock} compact />
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className={status === 'out' ? 'opacity-50 grayscale' : undefined}>
          <RifaIcon size={88} />
        </span>
        <p className={`font-display text-4xl font-extrabold text-balance ${status === 'won' ? 'text-sol' : ''}`}>{idleTitle}</p>
        <p className="text-lg text-niebla">{t(`hint.${status}`)}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {body}
    </div>
  );
}
