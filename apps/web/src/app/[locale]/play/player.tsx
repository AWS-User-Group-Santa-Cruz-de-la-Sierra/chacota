'use client';

import {
  channels,
  NICKNAME_MAX,
  type GameEvent,
  type GameSnapshot,
  type PublicQuestion,
  type RankEntry,
  type RealtimeConfig,
} from '@chacota/game/client';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AnswerIcon, ANSWER_STYLES } from '@/components/answer-icons';
import { choiceLabel } from '@/components/game/answer-grid';
import { useCountdown, useRealtime, useServerClock } from '@/components/game/use-realtime';
import { Logo } from '@/components/logo';
import { buttonClass } from '@/components/ui';

interface Session {
  token: string;
  gameId: string;
  playerId: string;
  nickname: string;
  pin: string;
}

type Screen =
  | { kind: 'join' }
  | { kind: 'lobby' }
  | { kind: 'question'; index: number; question: PublicQuestion; startedAt: number; answered?: string; timeUp?: boolean }
  | { kind: 'reveal'; index: number; correct: string[]; mine?: RankEntry; myAnswer?: string; poll: boolean }
  | { kind: 'leaderboard'; rank?: number; score?: number }
  | { kind: 'ended'; rank?: number; score?: number };

const STORAGE_KEY = 'chacota:session';

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode: the game still works, it just can't resume after a reload.
  }
}

export function PlayerApp({ apiUrl, realtime, initialPin }: { apiUrl: string; realtime: RealtimeConfig; initialPin: string }) {
  const t = useTranslations('play');
  const labels = { true: t('trueLabel'), false: t('falseLabel') };
  const clock = useServerClock();
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'join' });
  const [score, setScore] = useState(0);
  const [rank, setRank] = useState<number | undefined>();
  const [myAnswers, setMyAnswers] = useState<Record<number, string>>({});

  const resync = useCallback(
    async (s: Session) => {
      const res = await fetch(`${apiUrl}/state`, { headers: { authorization: `Bearer ${s.token}` } }).catch(() => null);
      if (!res) return;
      if (!res.ok) {
        saveSession(null);
        setSession(null);
        setScreen({ kind: 'join' });
        return;
      }
      const snap = (await res.json()) as GameSnapshot;
      clock.sync(snap.serverNow);
      if (snap.player) setScore(snap.player.score);
      const g = snap.game;
      if (g.status === 'lobby') setScreen({ kind: 'lobby' });
      else if (g.status === 'question' && g.question && g.startedAt)
        setScreen({ kind: 'question', index: g.index, question: g.question, startedAt: g.startedAt, answered: snap.answered?.value });
      else if (g.status === 'ended') setScreen({ kind: 'ended' });
      else setScreen({ kind: 'leaderboard' });
    },
    [apiUrl, clock],
  );

  // Resume a previous session (same PIN, or no PIN in the link).
  useEffect(() => {
    const stored = loadSession();
    if (stored && (!initialPin || initialPin === stored.pin)) {
      // localStorage only exists after hydration, so this sync has to happen in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(stored);
      void resync(stored);
    }
  }, [initialPin, resync]);

  const onEvent = useCallback(
    (e: GameEvent) => {
      if (!session) return;
      switch (e.type) {
        case 'question':
          clock.sync(e.serverNow);
          setScreen({ kind: 'question', index: e.index, question: e.question, startedAt: e.startedAt });
          break;
        case 'reveal': {
          const mine = e.ranks[session.playerId];
          if (mine) {
            setScore(mine.score);
            setRank(mine.rank);
          }
          setScreen({
            kind: 'reveal',
            index: e.index,
            correct: e.correct,
            mine,
            myAnswer: myAnswers[e.index],
            poll: e.correct.length === 0,
          });
          break;
        }
        case 'leaderboard':
          setScreen({ kind: 'leaderboard', rank, score });
          break;
        case 'ended': {
          const mine = e.ranks[session.playerId];
          setScreen({ kind: 'ended', rank: mine?.rank, score: mine?.score });
          break;
        }
      }
    },
    [session, clock, myAnswers, rank, score],
  );
  const { connected } = useRealtime(realtime, session ? [channels.public(session.gameId)] : [], onEvent, () => session && resync(session));

  async function join(pin: string, nickname: string): Promise<string | null> {
    const res = await fetch(`${apiUrl}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin, nickname }),
    }).catch(() => null);
    if (!res) return 'network';
    const body = (await res.json().catch(() => ({}))) as { error?: string } & Partial<Session>;
    if (!res.ok) return body.error ?? 'generic';
    const s: Session = { token: body.token!, gameId: body.gameId!, playerId: body.playerId!, nickname: body.nickname!, pin };
    saveSession(s);
    setSession(s);
    setScore(0);
    setRank(undefined);
    setMyAnswers({});
    await resync(s);
    return null;
  }

  async function answer(index: number, value: string) {
    if (!session || screen.kind !== 'question' || screen.answered) return;
    setScreen({ ...screen, answered: value });
    setMyAnswers((m) => ({ ...m, [index]: value }));
    const res = await fetch(`${apiUrl}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ questionIndex: index, value }),
    }).catch(() => null);
    if (res && !res.ok) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      if (error === 'not_accepting_answers') setScreen((s) => (s.kind === 'question' ? { ...s, timeUp: true } : s));
    }
  }

  function leave() {
    saveSession(null);
    setSession(null);
    setScreen({ kind: 'join' });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-noche px-4 pb-6 pt-4">
      <header className="flex items-center justify-between gap-3 pb-4">
        {session ? (
          <>
            <span className="truncate font-semibold">{session.nickname}</span>
            <span className="flex items-center gap-2">
              {!connected && <span className="text-xs text-sol">{t('reconnecting')}</span>}
              <span className="rounded-full bg-noche-2 px-3 py-1 font-bold tabular-nums">{t('score', { score })}</span>
            </span>
          </>
        ) : (
          <Logo size={30} />
        )}
      </header>

      <main className="flex flex-1 flex-col">
        {screen.kind === 'join' && <JoinForm initialPin={initialPin} onJoin={join} />}

        {screen.kind === 'lobby' && (
          <Centered>
            <p className="font-display text-4xl font-extrabold">{t('youreIn')}</p>
            <p className="text-lg text-niebla">{t('lookAtScreen')}</p>
          </Centered>
        )}

        {screen.kind === 'question' && (
          <QuestionScreen screen={screen} now={clock.now} labels={labels} onAnswer={(v) => answer(screen.index, v)} />
        )}

        {screen.kind === 'reveal' && <RevealScreen screen={screen} />}

        {screen.kind === 'leaderboard' && (
          <Centered>
            {screen.rank && <p className="font-display text-4xl font-extrabold">{t('rank', { rank: screen.rank })}</p>}
            <p className="text-lg text-niebla">{t('lookAtScreen')}</p>
          </Centered>
        )}

        {screen.kind === 'ended' && (
          <Centered>
            <p className="font-display text-4xl font-extrabold">{t('thanks')}</p>
            {screen.rank && <p className="text-2xl">{t('finalRank', { rank: screen.rank })}</p>}
            <button type="button" className={buttonClass('secondary', 'mt-4')} onClick={leave}>
              {t('leave')}
            </button>
          </Centered>
        )}
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">{children}</div>;
}

function JoinForm({ initialPin, onJoin }: { initialPin: string; onJoin: (pin: string, nickname: string) => Promise<string | null> }) {
  const t = useTranslations('play');
  const [pin, setPin] = useState(initialPin);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorKey = (code: string) =>
    (['game_not_found', 'game_ended', 'nickname_taken', 'invalid_nickname', 'network'] as const).includes(code as never)
      ? `errors.${code}`
      : 'errors.generic';

  return (
    <form
      className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(await onJoin(pin, nickname));
        setBusy(false);
      }}
    >
      <h1 className="font-display text-4xl font-extrabold">{t('title')}</h1>
      <label htmlFor="pin" className="sr-only">
        {t('pin')}
      </label>
      <input
        id="pin"
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{6}"
        maxLength={6}
        required
        placeholder={t('pin')}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        className="min-h-16 rounded-2xl border-2 border-noche-3 bg-noche-2 px-4 text-center font-display text-3xl font-bold tracking-[0.3em] placeholder:text-lg placeholder:font-medium placeholder:tracking-normal placeholder:text-niebla/70 focus:border-sol focus:outline-none"
      />
      <label htmlFor="nickname" className="sr-only">
        {t('nickname')}
      </label>
      <input
        id="nickname"
        autoComplete="nickname"
        maxLength={NICKNAME_MAX}
        required
        placeholder={t('nickname')}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className="min-h-14 rounded-2xl border-2 border-noche-3 bg-noche-2 px-4 text-center text-xl font-semibold placeholder:text-niebla/70 focus:border-sol focus:outline-none"
      />
      {error && (
        <p role="alert" className="rounded-xl bg-tajibo/20 px-4 py-3 text-center text-[#ff9cc0]">
          {t(errorKey(error))}
        </p>
      )}
      <button type="submit" disabled={busy || pin.length !== 6 || !nickname.trim()} className={buttonClass('primary', 'min-h-14 text-lg')}>
        {busy ? t('joining') : t('join')}
      </button>
    </form>
  );
}

function QuestionScreen({
  screen,
  now,
  labels,
  onAnswer,
}: {
  screen: Extract<Screen, { kind: 'question' }>;
  now: () => number;
  labels: { true: string; false: string };
  onAnswer: (value: string) => void;
}) {
  const t = useTranslations('play');
  const deadline = screen.startedAt + screen.question.timeLimitSec * 1000;
  const leadOrNull = useCountdown(screen.startedAt, now);
  const leftOrNull = useCountdown(deadline, now);

  if (leadOrNull === null || leftOrNull === null) return <Centered>{null}</Centered>;
  const lead = leadOrNull;
  const left = leftOrNull;
  if (screen.answered) {
    return (
      <Centered>
        <p className="font-display text-4xl font-extrabold">{t('sent')}</p>
        <p className="text-lg text-niebla">{t('waitOthers')}</p>
      </Centered>
    );
  }
  if (screen.timeUp || (lead === 0 && left === 0)) {
    return (
      <Centered>
        <p className="font-display text-4xl font-extrabold">{t('timeUp')}</p>
      </Centered>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-2xl font-extrabold leading-tight">{screen.question.prompt}</p>
        <span className="shrink-0 rounded-full bg-noche-2 px-3 py-1 font-display text-xl font-bold tabular-nums">
          {Math.ceil((lead > 0 ? lead : left) / 1000)}
        </span>
      </div>
      {lead > 0 ? (
        <Centered>
          <p className="font-display text-4xl font-extrabold text-sol">{t('getReady')}</p>
        </Centered>
      ) : (
        <div className={`grid flex-1 gap-3 ${screen.question.choices.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {screen.question.choices.map((c, i) => {
            const style = ANSWER_STYLES[i % ANSWER_STYLES.length]!;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onAnswer(c.id)}
                className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-3xl p-3 text-lg font-bold active:scale-[0.98] ${style.bg} ${style.fg}`}
              >
                <AnswerIcon index={i} size={48} />
                {choiceLabel(c, screen.question.type, labels)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RevealScreen({ screen }: { screen: Extract<Screen, { kind: 'reveal' }> }) {
  const t = useTranslations('play');
  const answered = screen.mine?.answered ?? screen.myAnswer !== undefined;
  const correct = screen.mine?.correct ?? (screen.myAnswer !== undefined && screen.correct.includes(screen.myAnswer));
  const tone = screen.poll ? 'bg-morado' : !answered ? 'bg-noche-2' : correct ? 'bg-verde' : 'bg-tajibo';
  return (
    <div className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl text-center ${tone}`}>
      <p className="font-display text-5xl font-extrabold">
        {screen.poll ? t('pollThanks') : !answered ? t('noAnswer') : correct ? t('correct') : t('incorrect')}
      </p>
      {!screen.poll && screen.mine && screen.mine.points > 0 && <p className="text-2xl font-bold">{t('points', { points: screen.mine.points })}</p>}
      {screen.mine && <p className="text-lg">{t('rank', { rank: screen.mine.rank })}</p>}
    </div>
  );
}
