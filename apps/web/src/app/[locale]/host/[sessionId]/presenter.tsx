'use client';

import { channels, createEventHub, frameOnEvent, type LiveEvent, type PlatformEvent, type RealtimeConfig, type SessionStatus, type Standing } from '@chacota/live/client';
import { mediaUrl, readableTextColor } from '@chacota/core';
import { useServerClock } from '@chacota/live/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { activityWebs } from '@/activities/registry.client';
import { useRealtime } from '@/components/game/use-realtime';
import { buttonClass } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { advanceSessionAction, endSessionAction, hostActionAction } from '../actions';

interface Props {
  sessionId: string;
  module: string;
  pin: string;
  title: string;
  orgName: string;
  orgSlug: string;
  primaryColor: string;
  /** The org's logo (S3 key), if it has one. */
  logoKey?: string;
  /** Base URL that turns S3 keys into public URLs. */
  mediaBaseUrl: string;
  joinUrl: string;
  joinHost: string;
  qrSvg: string;
  initial: { status: SessionStatus; version: number; serverNow: number; players: string[]; snapshot: Record<string, unknown> };
  realtime: RealtimeConfig;
}

/** Presenter frame for any activity: lobby with PIN and QR, the activity while it runs, then the podium. */
export function Presenter(props: Props) {
  const t = useTranslations('host');
  const tp = useTranslations('play');
  // Each activity's texts live under its id (e.g. tiluchi.card.name).
  const ta = useTranslations(props.module as 'tiluchi');
  const activity = activityWebs[props.module]!;
  const clock = useServerClock();
  const [hub] = useState(createEventHub);
  const [status, setStatus] = useState<SessionStatus>(props.initial.status);
  // Read by the realtime listener, which must not resubscribe on every change.
  const statusNow = useRef(props.initial.status);
  const [players, setPlayers] = useState<string[]>(props.initial.players);
  const [podium, setPodium] = useState<Standing[]>([]);
  const [advanceLabel, setAdvanceLabel] = useState(t('next'));
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [background, setBackground] = useState<string | null>(null);
  const [brokenMedia, setBrokenMedia] = useState<ReadonlySet<string>>(new Set());
  const toUrl = useCallback((key: string) => mediaUrl(props.mediaBaseUrl, key), [props.mediaBaseUrl]);
  const markBroken = (key: string) => setBrokenMedia((s) => new Set(s).add(key));
  const logo = props.logoKey && !brokenMedia.has(props.logoKey) ? toUrl(props.logoKey) : null;
  const onOrgColor = readableTextColor(props.primaryColor);

  useEffect(() => clock.sync(props.initial.serverNow), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onEvent = useCallback(
    (event: LiveEvent) => {
      const serverNow = (event as { serverNow?: unknown }).serverNow;
      if (typeof serverNow === 'number') clock.sync(serverNow);
      const e = event as PlatformEvent;
      if (e.type === 'player_joined') {
        setPlayers((p) => (p.includes(e.nickname) ? p : [...p, e.nickname]));
        return;
      }
      if (e.type === 'ended') {
        setPodium(e.podium);
        setBackground(null);
      }
      const step = frameOnEvent(statusNow.current, event.type);
      if (step.restart) hub.reset();
      if (step.status !== statusNow.current) {
        statusNow.current = step.status;
        setStatus(step.status);
      }
      if (step.deliver) hub.emit(event);
    },
    [clock, hub],
  );
  const { connected } = useRealtime(props.realtime, [channels.public(props.sessionId), channels.host(props.sessionId)], onEvent, () =>
    window.location.reload(),
  );

  // The version this screen shows. A second press before the first one returns carries the same
  // version and is refused by the server, so a double click never skips a step.
  const version = useRef(props.initial.version);
  const advancing = useRef(false);
  const advance = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    startTransition(async () => {
      try {
        version.current = (await advanceSessionAction(props.sessionId, version.current)).version;
      } finally {
        advancing.current = false;
      }
    });
  }, [props.sessionId]);
  const hostAction = useCallback((name: string, args?: unknown) => hostActionAction(props.sessionId, name, args), [props.sessionId]);

  // Keyboard / presentation clicker support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') && status !== 'ended') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, status]);

  const showBackground = background && !brokenMedia.has(background);
  return (
    <div className="relative flex min-h-dvh flex-col gap-6 bg-noche px-6 pt-7 pb-5 lg:px-10">
      {showBackground && (
        <div className="absolute inset-0" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- media comes from S3/CloudFront */}
          <img src={toUrl(background)} alt="" className="h-full w-full object-cover" onError={() => markBroken(background)} />
          <div className="absolute inset-0" style={{ background: 'rgba(26, 14, 46, 0.72)' }} />
        </div>
      )}
      {status !== 'lobby' && <div className="absolute inset-x-0 top-0 h-2" style={{ background: props.primaryColor }} aria-hidden="true" />}
      <header className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- media comes from S3/CloudFront
            <img src={logo} alt={props.orgName} className="h-10 max-w-40 object-contain" onError={() => markBroken(props.logoKey!)} />
          ) : (
            <activity.Icon size={44} color={props.primaryColor} />
          )}
          <div className="flex flex-col">
            <span className="font-semibold">{props.orgName}</span>
            <span className="text-sm text-niebla">
              {props.title}
              {status === 'running' && subtitle ? ` · ${subtitle}` : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!connected && <span className="text-sm text-sol">{tp('reconnecting')}</span>}
          {status !== 'lobby' && logo && <activity.Icon size={44} color={props.primaryColor} />}
          {status === 'running' && (
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

      <main className="relative flex flex-1 flex-col justify-center gap-8">
        {status === 'lobby' && (
          <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <section
              className="flex flex-col justify-between gap-10 rounded-3xl p-8 lg:p-10"
              style={{ background: props.primaryColor, color: onOrgColor }}
            >
              <div className="flex flex-col gap-4">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- media comes from S3/CloudFront
                  <img src={logo} alt={props.orgName} className="h-24 max-w-60 object-contain object-left" onError={() => markBroken(props.logoKey!)} />
                ) : (
                  <span className="font-display text-5xl font-extrabold leading-tight">{props.orgName}</span>
                )}
                <span className="text-xl font-semibold">{t('presents', { org: props.orgName })}</span>
              </div>
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <activity.Icon size={96} color={props.primaryColor} />
                  <span className="font-display text-5xl font-extrabold tracking-tight">{ta('card.name')}</span>
                </div>
                <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight lg:text-6xl">{props.title}</h1>
              </div>
            </section>
            <div className="grid items-center gap-10 xl:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-6">
              <p className="text-2xl text-niebla">
                {t('joinAt')} <span className="font-bold text-blanco">{props.joinHost}</span> {t('withPin')}
              </p>
              <p className="font-display text-[6rem] font-extrabold leading-none tracking-[0.12em] text-sol xl:text-[8rem]">
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
          </div>
        )}

        {status === 'running' && (
          <activity.Host
            sessionId={props.sessionId}
            snapshot={props.initial.snapshot}
            clock={clock}
            playerCount={players.length}
            subscribe={hub.subscribe}
            advance={advance}
            setAdvanceLabel={setAdvanceLabel}
            setSubtitle={setSubtitle}
            hostAction={hostAction}
            setBackground={setBackground}
            mediaUrl={toUrl}
          />
        )}

        {status === 'ended' && (
          <div className="flex flex-col items-center gap-8">
            <h1 className="font-display text-6xl font-extrabold">{t('podium')}</h1>
            <ol className="flex items-end justify-center gap-4">
              {[1, 0, 2].map((pos) => {
                const s = podium[pos];
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

      <footer className="relative flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-niebla">{status !== 'ended' ? t('keyboardHint') : t('finished')}</span>
        <div className="flex gap-2">
          {status === 'running' && (
            <button
              type="button"
              className={buttonClass('ghost')}
              onClick={() => confirm(t('confirmEnd')) && startTransition(() => endSessionAction(props.sessionId))}
            >
              {t('end')}
            </button>
          )}
          {status === 'ended' ? (
            <>
              <Link href={`/app/orgs/${props.orgSlug}/${props.module}`} className={buttonClass('ghost')}>
                {t('backToActivity', { name: ta('card.name') })}
              </Link>
              <Link href={`/app/orgs/${props.orgSlug}/historial/${props.sessionId}`} className={buttonClass('primary')}>
                {t('results')}
              </Link>
            </>
          ) : (
            <button type="button" className={buttonClass('primary', 'min-h-14 px-8 text-lg')} onClick={advance} disabled={pending}>
              {status === 'lobby' ? t('start') : advanceLabel}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
