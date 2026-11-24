'use client';

import { channels, createEventHub, frameOnEvent, type LiveEvent, type PlatformEvent, type RealtimeConfig, type SessionStatus, type Standing } from '@chacota/live/client';
import { mediaUrl, readableTextColor } from '@chacota/core';
import { useServerClock } from '@chacota/live/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { activityWebs } from '@/activities/registry.client';
import { useRealtime } from '@/components/game/use-realtime';
import { BackLink } from '@/components/back-link';
import { Podium } from '@/components/game/podium';
import { buttonClass } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { newerVersion } from '@/lib/host-version';
import { advanceSessionAction, endSessionAction, finalSnapshotAction, hostActionAction } from '../actions';

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
  /** False when the session has no phones: no PIN in the header and no saved results. */
  phones: boolean;
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
  const [advanceDisabled, setAdvanceDisabledState] = useState(false);
  const advanceDisabledNow = useRef(false);
  const setAdvanceDisabled = useCallback((disabled: boolean) => {
    advanceDisabledNow.current = disabled;
    setAdvanceDisabledState(disabled);
  }, []);
  // The activity's own final data, for activities that replace the podium.
  const [final, setFinal] = useState<Record<string, unknown> | null>(props.initial.status === 'ended' ? props.initial.snapshot : null);
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
        if (activity.Final) finalSnapshotAction(props.sessionId).then(setFinal, () => setFinal({}));
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
    [clock, hub, activity, props.sessionId],
  );
  const { connected } = useRealtime(props.realtime, [channels.public(props.sessionId), channels.host(props.sessionId)], onEvent, () =>
    window.location.reload(),
  );

  // The version this screen shows. A second press before the first one returns carries the same
  // version and is refused by the server, so a double click never skips a step.
  const version = useRef(props.initial.version);
  const advancing = useRef(false);
  const advance = useCallback(() => {
    if (advancing.current || advanceDisabledNow.current) return;
    advancing.current = true;
    startTransition(async () => {
      try {
        version.current = (await advanceSessionAction(props.sessionId, version.current)).version;
      } finally {
        advancing.current = false;
      }
    });
  }, [props.sessionId]);
  const hostAction = useCallback(
    async (name: string, args?: unknown) => {
      const result = await hostActionAction(props.sessionId, name, args);
      version.current = newerVersion(version.current, result);
      return result;
    },
    [props.sessionId],
  );

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
  const fullscreenButton = (
    <button
      type="button"
      className={buttonClass('ghost')}
      onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
    >
      {t('fullscreen')}
    </button>
  );
  const orgLogo = (className: string) =>
    logo ? (
      // eslint-disable-next-line @next/next/no-img-element -- media comes from S3/CloudFront
      <img src={logo} alt={props.orgName} className={className} onError={() => markBroken(props.logoKey!)} />
    ) : null;

  // Lobby: the org's panel on the left (its color, logo, "presents", the activity and the title),
  // how to join on the right. Same layout as the "Lobby" mockup.
  if (status === 'lobby') {
    return (
      <div className="flex min-h-dvh flex-col bg-noche lg:flex-row">
        <section
          className="flex flex-col justify-between gap-10 p-8 lg:w-[42%] lg:shrink-0 lg:p-12"
          style={{ background: props.primaryColor, color: onOrgColor }}
        >
          <div className="flex flex-col gap-4">
            {orgLogo('h-48 w-full max-w-full object-contain object-left lg:h-72') ?? (
              <span className="font-display text-5xl font-extrabold leading-tight">{props.orgName}</span>
            )}
            <span className="font-display text-3xl font-bold leading-tight lg:text-4xl">{t('presents', { org: props.orgName })}</span>
          </div>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <activity.Icon size={96} color={props.primaryColor} />
              <span className="font-display text-[2.75rem] font-extrabold lowercase tracking-tight">{ta('card.name')}</span>
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight lg:text-7xl">{props.title}</h1>
            {activity.LobbySummary && (
              <p className="text-2xl font-semibold opacity-90">
                <activity.LobbySummary snapshot={props.initial.snapshot} />
              </p>
            )}
          </div>
        </section>

        <main className="flex flex-1 flex-col gap-8 p-8 lg:p-12">
          <div className="flex flex-wrap items-center gap-8">
            <div
              className="w-48 shrink-0 rounded-3xl bg-blanco p-3 lg:w-56"
              role="img"
              aria-label={props.joinUrl}
              dangerouslySetInnerHTML={{ __html: props.qrSvg }}
            />
            <div className="flex flex-col gap-3">
              <p className="text-xl text-niebla">
                {t('joinAt')} <span className="font-bold text-blanco">{props.joinHost}</span> {t('withPin')}
              </p>
              <p className="font-display text-[5rem] font-extrabold leading-none tracking-[0.08em] text-sol xl:text-[7rem]">
                {props.pin.slice(0, 3)} {props.pin.slice(3)}
              </p>
            </div>
          </div>

          <p className="flex items-baseline gap-3">
            <span className="font-display text-5xl font-extrabold tabular-nums">{players.length}</span>
            <span className="text-xl text-niebla">{t('playersReady', { count: players.length })}</span>
          </p>
          <ul className="flex flex-1 flex-wrap content-start gap-2" aria-live="polite">
            {players.map((name) => (
              <li key={name} className="rounded-full bg-noche-2 px-4 py-2 text-lg font-semibold">
                {name}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {!connected && <span className="text-sm text-sol">{tp('reconnecting')}</span>}
            <div className="mr-auto flex flex-wrap items-center gap-4">
              {/* Leaving the lobby is harmless: nobody is playing yet and the session expires on its own. */}
              <BackLink href={`/app/orgs/${props.orgSlug}/${props.module}`}>{t('backToActivity', { name: ta('card.name') })}</BackLink>
              <span className="text-sm text-niebla">{t('keyboardHint')}</span>
            </div>
            {fullscreenButton}
            <button
              type="button"
              className={buttonClass('primary', 'min-h-14 bg-sol px-10 text-xl text-noche hover:bg-sol/90')}
              onClick={advance}
              disabled={pending}
            >
              {t('start')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col gap-6 bg-noche px-6 pt-7 pb-5 lg:px-10">
      {showBackground && (
        <div className="absolute inset-0" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- media comes from S3/CloudFront */}
          <img src={toUrl(background)} alt="" className="h-full w-full object-cover" onError={() => markBroken(background)} />
          <div className="absolute inset-0" style={{ background: 'rgba(26, 14, 46, 0.72)' }} />
        </div>
      )}
      <div className="absolute inset-x-0 top-0 h-2" style={{ background: props.primaryColor }} aria-hidden="true" />

      {/* Header as in the "Pregunta" mockups: org and progress on the left, activity and PIN on the right. */}
      <header className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {orgLogo('h-24 max-w-96 object-contain') ?? <span className="font-display text-xl font-bold">{props.orgName}</span>}
          <span className="text-niebla">{status === 'running' && subtitle ? subtitle : props.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {!connected && <span className="text-sm text-sol">{tp('reconnecting')}</span>}
          <activity.Icon size={44} color={props.primaryColor} />
          <span className="font-display text-[1.375rem] font-extrabold lowercase tracking-tight">{ta('card.name')}</span>
          {status === 'running' && props.phones && (
            <span className="ml-3 rounded-full bg-noche-2 px-4 py-2 text-sm text-niebla">
              {props.joinHost} · PIN <span className="font-display text-lg font-extrabold tracking-widest text-sol">{props.pin}</span>
            </span>
          )}
          {fullscreenButton}
        </div>
      </header>

      <main className="relative flex flex-1 flex-col justify-center gap-8">
        {status === 'running' && (
          <activity.Host
            sessionId={props.sessionId}
            snapshot={props.initial.snapshot}
            clock={clock}
            playerCount={players.length}
            subscribe={hub.subscribe}
            advance={advance}
            setAdvanceLabel={setAdvanceLabel}
            setAdvanceDisabled={setAdvanceDisabled}
            setSubtitle={setSubtitle}
            hostAction={hostAction}
            setBackground={setBackground}
            mediaUrl={toUrl}
          />
        )}

        {status === 'ended' &&
          (activity.Final ? final && <activity.Final snapshot={final} /> : <Podium title={t('podium')} mentionsLabel={t('mentions')} podium={podium} />)}
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
              {props.phones && (
                <Link href={`/app/orgs/${props.orgSlug}/historial/${props.sessionId}`} className={buttonClass('primary')}>
                  {t('results')}
                </Link>
              )}
            </>
          ) : (
            <button type="button" className={buttonClass('primary', 'min-h-14 px-8 text-lg')} onClick={advance} disabled={pending || advanceDisabled}>
              {advanceLabel}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
