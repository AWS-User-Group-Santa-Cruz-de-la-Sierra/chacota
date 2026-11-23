'use client';

import { channels, createEventHub, frameOnEvent, NICKNAME_MAX, playerCode, type LiveEvent, type PlatformEvent, type RealtimeConfig } from '@chacota/live/client';
import { useServerClock } from '@chacota/live/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { activityWebs } from '@/activities/registry.client';
import { useRealtime } from '@/components/game/use-realtime';
import { Logo } from '@/components/logo';
import { readSessionCookie, resumeRetryDelay, sessionCookie, shouldForgetSession } from '@/lib/player-session';
import { buttonClass } from '@/components/ui';

interface Session {
  token: string;
  sessionId: string;
  module: string;
  playerId: string;
  nickname: string;
  pin: string;
}

type Screen =
  | { kind: 'join' }
  /** A saved session was found after a reload and /state has not answered yet. */
  | { kind: 'resuming' }
  | { kind: 'lobby' }
  /** `key` remounts the activity screen whenever it starts from a new snapshot. */
  | { kind: 'running'; snapshot: Record<string, unknown>; key: number }
  | { kind: 'ended'; rank?: number };

interface Snapshot {
  session: { status: 'lobby' | 'running' | 'ended'; module: string };
  player?: { score: number };
  module: Record<string, unknown>;
  serverNow: number;
}

const STORAGE_KEY = 'chacota:session';
const STATE_TIMEOUT_MS = 8000;

function fromStorage(): Partial<Session> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Session>) : null;
  } catch {
    return null;
  }
}

/** localStorage first, then the cookie copy (camera apps' viewers may not keep localStorage). */
function loadSession(): Session | null {
  const session = fromStorage() ?? (readSessionCookie(document.cookie) as Partial<Session> | null);
  // Sessions saved before sessions had these fields cannot be resumed.
  return session?.sessionId && session.module && session.token ? (session as Session) : null;
}

function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or an in-app viewer: the cookie below still lets the player resume.
  }
  try {
    document.cookie = sessionCookie(session, location.protocol === 'https:');
  } catch {
    // Cookies blocked too: the game still works, it just can't resume after a reload.
  }
}

/** Phone frame for any activity: join, lobby, the activity while it runs, then rank and code. */
export function PlayerApp({ apiUrl, realtime, initialPin }: { apiUrl: string; realtime: RealtimeConfig; initialPin: string }) {
  const t = useTranslations('play');
  const clock = useServerClock();
  const [hub] = useState(createEventHub);
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreenState] = useState<Screen>({ kind: 'join' });
  // The realtime listener reads the current screen without resubscribing.
  const screenNow = useRef<Screen>(screen);
  const setScreen = useCallback((next: Screen) => {
    screenNow.current = next;
    setScreenState(next);
  }, []);
  const [score, setScore] = useState(0);

  /** Loads the current state. False when the API could not answer for now (network, 429, 5xx). */
  const resync = useCallback(
    async (s: Session): Promise<boolean> => {
      const res = await fetch(`${apiUrl}/state`, {
        headers: { authorization: `Bearer ${s.token}` },
        // A slow network can leave the request hanging: give up and let the caller retry.
        signal: AbortSignal.timeout(STATE_TIMEOUT_MS),
      }).catch(() => null);
      if (!res) return false;
      if (!res.ok) {
        if (!shouldForgetSession(res.status)) return false;
        saveSession(null);
        setSession(null);
        setScreen({ kind: 'join' });
        return true;
      }
      const snap = (await res.json()) as Snapshot;
      clock.sync(snap.serverNow);
      if (snap.player) setScore(snap.player.score);
      hub.reset();
      if (snap.session.status === 'lobby') setScreen({ kind: 'lobby' });
      else if (snap.session.status === 'ended') setScreen({ kind: 'ended' });
      else setScreen({ kind: 'running', snapshot: snap.module, key: Date.now() });
      return true;
    },
    [apiUrl, clock, hub, setScreen],
  );

  // Resume a previous session (same PIN, or no PIN in the link).
  // Until /state answers the phone shows "reconnecting", not the join form: joining again from
  // there would create a second player and lose the score.
  useEffect(() => {
    const stored = loadSession();
    if (!stored || (initialPin && initialPin !== stored.pin)) return;
    // localStorage only exists after hydration, so this sync has to happen in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(stored);
    setScreen({ kind: 'resuming' });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const attempt = async (n: number) => {
      const done = await resync(stored);
      // The player may have left, or realtime resynced in the meantime.
      if (!done && !cancelled && screenNow.current.kind === 'resuming') timer = setTimeout(() => void attempt(n + 1), resumeRetryDelay(n));
    };
    void attempt(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [initialPin, resync, setScreen]);

  const onEvent = useCallback(
    (event: LiveEvent) => {
      if (!session) return;
      const serverNow = (event as { serverNow?: unknown }).serverNow;
      if (typeof serverNow === 'number') clock.sync(serverNow);
      const e = event as PlatformEvent;
      if (e.type === 'ended') {
        const mine = e.ranks[session.playerId];
        if (mine) setScore(mine.score);
        setScreen({ kind: 'ended', rank: mine?.rank });
        return;
      }
      const current = screenNow.current.kind;
      const step = frameOnEvent(current === 'running' ? 'running' : current === 'ended' ? 'ended' : 'lobby', event.type);
      if (step.restart) {
        hub.reset();
        setScreen({ kind: 'running', snapshot: {}, key: Date.now() });
      }
      if (step.deliver) hub.emit(event);
    },
    [session, clock, hub, setScreen],
  );
  const { connected } = useRealtime(realtime, session ? [channels.public(session.sessionId)] : [], onEvent, () => session && resync(session));

  async function join(pin: string, nickname: string): Promise<string | null> {
    const res = await fetch(`${apiUrl}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin, nickname }),
    }).catch(() => null);
    if (!res) return 'network';
    const body = (await res.json().catch(() => ({}))) as { error?: string } & Partial<Session>;
    if (!res.ok) return body.error ?? 'generic';
    const s: Session = {
      token: body.token!,
      sessionId: body.sessionId!,
      module: body.module!,
      playerId: body.playerId!,
      nickname: body.nickname!,
      pin,
    };
    saveSession(s);
    setSession(s);
    setScore(0);
    await resync(s);
    return null;
  }

  function leave() {
    saveSession(null);
    setSession(null);
    setScreen({ kind: 'join' });
  }

  const Play = session ? activityWebs[session.module]?.Play : undefined;

  return (
    <div className="flex min-h-svh flex-col bg-noche px-4 pb-6 pt-4">
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

        {screen.kind === 'resuming' && (
          <Centered>
            <p className="text-lg text-niebla">{t('reconnecting')}</p>
            <button type="button" className={buttonClass('secondary', 'mt-4')} onClick={leave}>
              {t('leave')}
            </button>
          </Centered>
        )}

        {screen.kind === 'lobby' && (
          <Centered>
            <p className="font-display text-4xl font-extrabold">{t('youreIn')}</p>
            <p className="text-lg text-niebla">{t('lookAtScreen')}</p>
          </Centered>
        )}

        {screen.kind === 'running' && session && Play && (
          <Play
            key={screen.key}
            sessionId={session.sessionId}
            playerId={session.playerId}
            token={session.token}
            apiUrl={apiUrl}
            snapshot={screen.snapshot}
            clock={clock}
            subscribe={hub.subscribe}
            setScore={setScore}
          />
        )}

        {screen.kind === 'running' && !Play && (
          <Centered>
            <p className="text-lg text-niebla">{t('lookAtScreen')}</p>
          </Centered>
        )}

        {screen.kind === 'ended' && (
          <Centered>
            <p className="font-display text-4xl font-extrabold">{t('thanks')}</p>
            {screen.rank && <p className="text-2xl">{t('finalRank', { rank: screen.rank })}</p>}
            {session && (
              <div className="mt-4 flex flex-col items-center gap-1 rounded-2xl border border-noche-3 bg-noche-2 px-6 py-4">
                <span className="text-sm text-niebla">{t('yourCode')}</span>
                <span className="font-mono text-4xl font-bold tracking-[0.3em]">{playerCode(session.playerId)}</span>
                <span className="max-w-64 text-sm text-niebla">{t('codeHint')}</span>
              </div>
            )}
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
    (['session_not_found', 'session_ended', 'nickname_taken', 'invalid_nickname', 'network'] as const).includes(code as never)
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
