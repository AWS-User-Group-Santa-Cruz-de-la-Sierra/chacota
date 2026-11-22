'use client';

import { channels, QUESTION_LEAD_MS, type GameEvent, type GameStatus, type PublicQuestion, type RealtimeConfig, type Standing } from '@chacota/game/client';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { AnswerTiles } from '@/components/game/answer-grid';
import { useCountdown, useRealtime, useServerClock } from '@/components/game/use-realtime';
import { TiluchiMark } from '@/components/logo';
import { buttonClass } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { advanceGameAction, answerCountAction, endGameAction } from '../actions';

interface Props {
  gameId: string;
  pin: string;
  title: string;
  orgName: string;
  orgSlug: string;
  primaryColor: string;
  joinUrl: string;
  joinHost: string;
  qrSvg: string;
  questions: PublicQuestion[];
  initial: { status: GameStatus; index: number; startedAt?: number; serverNow: number; players: string[] };
  realtime: RealtimeConfig;
}

type Screen =
  | { kind: 'lobby' }
  | { kind: 'question'; index: number; startedAt: number }
  | { kind: 'reveal'; index: number; correct: string[]; counts: Record<string, number>; answered: number }
  | { kind: 'leaderboard'; index: number; top: Standing[] }
  | { kind: 'ended'; podium: Standing[] };

function initialScreen(initial: Props['initial']): Screen {
  switch (initial.status) {
    case 'lobby':
      return { kind: 'lobby' };
    case 'question':
      return { kind: 'question', index: initial.index, startedAt: initial.startedAt ?? initial.serverNow };
    case 'reveal':
      return { kind: 'reveal', index: initial.index, correct: [], counts: {}, answered: 0 };
    case 'leaderboard':
      return { kind: 'leaderboard', index: initial.index, top: [] };
    case 'ended':
      return { kind: 'ended', podium: [] };
  }
}

export function Presenter(props: Props) {
  const t = useTranslations('host');
  const tp = useTranslations('play');
  const labels = { true: tp('trueLabel'), false: tp('falseLabel') };
  const clock = useServerClock();
  const [screen, setScreen] = useState<Screen>(() => initialScreen(props.initial));
  const [players, setPlayers] = useState<string[]>(props.initial.players);
  const [answerCount, setAnswerCount] = useState(0);
  const [pending, startTransition] = useTransition();
  const autoRevealed = useRef(-1);
  const total = props.questions.length;

  useEffect(() => clock.sync(props.initial.serverNow), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onEvent = useCallback(
    (e: GameEvent) => {
      switch (e.type) {
        case 'player_joined':
          setPlayers((p) => (p.includes(e.nickname) ? p : [...p, e.nickname]));
          break;
        case 'question':
          clock.sync(e.serverNow);
          setAnswerCount(0);
          setScreen({ kind: 'question', index: e.index, startedAt: e.startedAt });
          break;
        case 'reveal':
          setScreen({ kind: 'reveal', index: e.index, correct: e.correct, counts: e.counts, answered: e.answered });
          break;
        case 'leaderboard':
          setScreen({ kind: 'leaderboard', index: e.index, top: e.top });
          break;
        case 'ended':
          setScreen({ kind: 'ended', podium: e.podium });
          break;
      }
    },
    [clock],
  );
  const { connected } = useRealtime(props.realtime, [channels.public(props.gameId), channels.host(props.gameId)], onEvent, () =>
    window.location.reload(),
  );

  const advance = useCallback(() => {
    startTransition(async () => {
      await advanceGameAction(props.gameId);
    });
  }, [props.gameId]);

  // Keyboard / presentation clicker support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') && screen.kind !== 'ended') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, screen.kind]);

  // While a question is open: poll the answer count, reveal when time is up or everyone answered.
  const question = screen.kind === 'question' ? props.questions[screen.index] : undefined;
  const deadline = screen.kind === 'question' && question ? screen.startedAt + question.timeLimitSec * 1000 : undefined;
  const msLeftOrNull = useCountdown(deadline, clock.now);
  const leadLeftOrNull = useCountdown(screen.kind === 'question' ? screen.startedAt : undefined, clock.now);
  // Until mounted the clock is unknown: show the reading phase without numbers.
  const ready = msLeftOrNull !== null && leadLeftOrNull !== null;
  const msLeft = msLeftOrNull ?? 0;
  const leadLeft = leadLeftOrNull ?? QUESTION_LEAD_MS;

  useEffect(() => {
    if (screen.kind !== 'question') return;
    const index = screen.index;
    const timer = setInterval(async () => setAnswerCount(await answerCountAction(props.gameId, index)), 1000);
    return () => clearInterval(timer);
  }, [screen, props.gameId]);

  useEffect(() => {
    if (screen.kind !== 'question' || autoRevealed.current === screen.index) return;
    const everyone = players.length > 0 && answerCount >= players.length;
    if ((ready && deadline && msLeft === 0) || everyone) {
      autoRevealed.current = screen.index;
      advance();
    }
  }, [screen, msLeft, ready, answerCount, players.length, deadline, advance]);

  const accent = props.primaryColor;

  return (
    <div className="flex min-h-dvh flex-col gap-6 bg-noche px-6 py-5 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TiluchiMark size={44} color={accent} />
          <div className="flex flex-col">
            <span className="font-semibold">{props.orgName}</span>
            <span className="text-sm text-niebla">
              {props.title}
              {screen.kind === 'question' || screen.kind === 'reveal' ? ` · ${t('questionOf', { n: screen.index + 1, total })}` : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!connected && <span className="text-sm text-sol">{tp('reconnecting')}</span>}
          {screen.kind !== 'lobby' && screen.kind !== 'ended' && (
            <span className="rounded-full bg-noche-2 px-4 py-2 text-sm text-niebla">
              {props.joinHost} · PIN <span className="font-display text-lg font-extrabold tracking-widest text-sol">{props.pin}</span>
            </span>
          )}
          <button
            type="button"
            className={buttonClass('ghost')}
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
          >
            {t('fullscreen')}
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-8">
        {screen.kind === 'lobby' && (
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-6">
              <p className="text-2xl text-niebla">
                {t('joinAt')} <span className="font-bold text-blanco">{props.joinHost}</span> {t('withPin')}
              </p>
              <p className="font-display text-[7rem] font-extrabold leading-none tracking-[0.12em] text-sol lg:text-[10rem]">
                {props.pin.slice(0, 3)} {props.pin.slice(3)}
              </p>
              <p className="text-xl font-semibold">{t('players', { count: players.length })}</p>
              <ul className="flex flex-wrap gap-2" aria-live="polite">
                {players.map((name) => (
                  <li key={name} className="rounded-full bg-noche-2 px-4 py-2 text-lg font-semibold">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="w-64 rounded-3xl bg-blanco p-4 lg:w-80"
              role="img"
              aria-label={props.joinUrl}
              dangerouslySetInnerHTML={{ __html: props.qrSvg }}
            />
          </div>
        )}

        {screen.kind === 'question' && question && (
          <>
            <div className="flex items-center gap-8">
              <div
                className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full font-display text-6xl font-extrabold"
                style={{
                  background: `conic-gradient(#FFC629 0 ${!ready || leadLeft > 0 ? 100 : Math.round((msLeft / (question.timeLimitSec * 1000)) * 1000) / 10}%, #2B1A47 0)`,
                }}
              >
                <span className="flex h-26 w-26 items-center justify-center rounded-full bg-noche tabular-nums">
                  {!ready ? '' : leadLeft > 0 ? Math.ceil(leadLeft / 1000) : Math.ceil(msLeft / 1000)}
                </span>
              </div>
              <h1 className="flex-1 font-display text-4xl font-extrabold leading-tight tracking-tight lg:text-6xl">{question.prompt}</h1>
              <div className="flex shrink-0 flex-col items-center">
                <span className="font-display text-6xl font-extrabold tabular-nums">{answerCount}</span>
                <span className="text-niebla">{t('answers', { count: answerCount })}</span>
              </div>
            </div>
            {leadLeft > QUESTION_LEAD_MS / 3 ? (
              <p className="text-center font-display text-4xl font-bold text-sol">{t('getReady')}</p>
            ) : (
              <AnswerTiles question={question} labels={labels} />
            )}
          </>
        )}

        {screen.kind === 'reveal' && props.questions[screen.index] && (
          <>
            <h1 className="font-display text-4xl font-extrabold leading-tight lg:text-5xl">{props.questions[screen.index]!.prompt}</h1>
            <AnswerTiles question={props.questions[screen.index]!} labels={labels} highlight={screen.correct} counts={screen.counts} />
            <p className="text-center text-xl text-niebla">{t('answers', { count: screen.answered })}</p>
          </>
        )}

        {screen.kind === 'leaderboard' && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <h1 className="text-center font-display text-5xl font-extrabold">{t('ranking')}</h1>
            <ol className="flex flex-col gap-3">
              {screen.top.map((s, i) => (
                <li key={s.nickname} className="flex items-center gap-4 rounded-2xl bg-noche-2 px-6 py-4 text-2xl font-bold">
                  <span className="w-10 font-display text-niebla">{i + 1}</span>
                  <span className="flex-1">{s.nickname}</span>
                  <span className="font-display tabular-nums">{s.score}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {screen.kind === 'ended' && (
          <div className="flex flex-col items-center gap-8">
            <h1 className="font-display text-6xl font-extrabold">{t('podium')}</h1>
            <ol className="flex items-end justify-center gap-4">
              {[1, 0, 2].map((pos) => {
                const s = screen.podium[pos];
                if (!s) return null;
                const height = ['h-64', 'h-48', 'h-36'][pos];
                const bg = ['bg-sol text-noche', 'bg-morado', 'bg-tajibo'][pos];
                return (
                  <li key={pos} className="flex w-40 flex-col items-center gap-2 lg:w-56">
                    <span className="text-center text-2xl font-bold">{s.nickname}</span>
                    <span className="font-display text-xl tabular-nums text-niebla">{s.score}</span>
                    <span className={`flex w-full items-start justify-center rounded-t-2xl pt-4 font-display text-5xl font-extrabold ${height} ${bg}`}>
                      {pos + 1}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-niebla">{screen.kind !== 'ended' ? t('keyboardHint') : t('finished')}</span>
        <div className="flex gap-2">
          {screen.kind !== 'ended' && screen.kind !== 'lobby' && (
            <button
              type="button"
              className={buttonClass('ghost')}
              onClick={() => confirm(t('confirmEnd')) && startTransition(() => endGameAction(props.gameId))}
            >
              {t('end')}
            </button>
          )}
          {screen.kind === 'ended' ? (
            <Link href={`/app/orgs/${props.orgSlug}`} className={buttonClass('primary')}>
              {t('backToOrg')}
            </Link>
          ) : (
            <button type="button" className={buttonClass('primary', 'min-h-14 px-8 text-lg')} onClick={advance} disabled={pending}>
              {screen.kind === 'lobby'
                ? t('start')
                : screen.kind === 'question'
                  ? t('showAnswer')
                  : screen.kind === 'reveal'
                    ? t('showRanking')
                    : screen.index + 1 < total
                      ? t('nextQuestion')
                      : t('showPodium')}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
