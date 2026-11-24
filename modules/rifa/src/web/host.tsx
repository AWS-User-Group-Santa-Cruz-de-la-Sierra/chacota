'use client';

import type { HostScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { BagEntry, BagReply, HostSnapshot, OnOverboard, RifaEvent, Round } from '../model';
import { stepAt } from '../timeline';
import { BagChips } from './bag-chips';
import { Controls } from './controls';
import { advanceState, applyBagReply, applyHostEvent, visibleEntries, visibleWinners, type HostData } from './host-state';
import { ScenePlayer } from './scene-player';
import { Duende, DuendeDefs } from './scenes/duende';
import { Stage, Stars, useSvgIds } from './scenes/stage';
import { SCENE_STYLES } from './scenes/styles';
import { useRoundTicker } from './use-round-ticker';
import { WinnersList } from './winners-list';

/** Pause between two bag fetches while players keep joining. */
const REFETCH_GAP_MS = 500;
/** A failed bag fetch is retried after 0.5, 1 and 2 s before the screen says so. */
const FETCH_RETRIES = 3;
const RETRY_MS = 500;
const FAILED_SHOWN_MS = 6_000;
const STAGE_BG = 'radial-gradient(ellipse at 50% 110%, rgb(11 128 72 / .33), transparent 60%), linear-gradient(#2b1a47, #1a0e2e)';

const READY_STARS: [number, number, number, string, string][] = [
  [40, 30, 1.6, '2.2s', '0s'],
  [92, 86, 1.2, '2.8s', '.3s'],
  [330, 22, 1.4, '3s', '.6s'],
  [360, 96, 1.8, '2.6s', '1.1s'],
  [60, 150, 1.2, '2.4s', '.9s'],
  [345, 170, 1.4, '2.9s', '.4s'],
];

/** The stage before the first round (and after a reset): a duende waiting with a "?" on its sign. */
function ReadyStage() {
  const t = useTranslations('rifa.host');
  const id = useSvgIds();
  return (
    <div className="rifa-stage">
      <style href="rifa-scenes" precedence="default">
        {SCENE_STYLES}
      </style>
      <Stage ids={id} label={t('ready')}>
        <DuendeDefs />
        <rect width="400" height="300" fill="#1a0e2e" />
        <Stars points={READY_STARS} />
        <ellipse cx="200" cy="292" rx="150" ry="20" fill="#0b8048" opacity=".35" />
        <text x="200" y="50" textAnchor="middle" fontSize="28" fill="#ffc629">
          {t('ready')}
        </text>
        <Duende name="?" x={200} y={286} scale={0.55} loop="rifa-bob 2.4s ease-in-out infinite" />
      </Stage>
    </div>
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sort key that ignores case and accents and is the same on the server and in every browser. */
const nameKey = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const byName = (a: BagEntry, b: BagEntry) => {
  const x = nameKey(a.name);
  const y = nameKey(b.name);
  return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : 1;
};

/** The short line over the stage, and what a screen reader hears, for the step playing now. */
function useCaption(round: Round | null, now: number): { caption: string | null; announce: string } {
  const t = useTranslations('rifa.host');
  if (!round) return { caption: null, announce: '' };
  const step = stepAt(round, now);
  if (step.kind === 'waiting') return { caption: t('caption.waiting', { round: round.n }), announce: '' };
  if (step.kind === 'out') {
    return {
      caption: t('caption.out', { n: step.index + 1, total: round.out.length }),
      announce: t('announce.out', { name: round.out[step.index]!.name }),
    };
  }
  return { caption: t('caption.winner', { round: round.n }), announce: t('announce.winner', { name: round.winner.name }) };
}

/**
 * The big screen ("la bolsa a la vista"): the stage with the winners beside it, everyone in the rifa
 * as chips below, and the bag controls. Each round plays from its `rifa.round` event, so every open
 * presenter screen shows the same one; nothing of its result shows before its step does.
 */
export function RifaHost({ snapshot, clock, playerCount, subscribe, hostAction, setAdvanceLabel, setAdvanceDisabled, setSubtitle }: HostScreenProps) {
  const s0 = snapshot as unknown as Partial<HostSnapshot>;
  const t = useTranslations('rifa.host');
  const mode = s0.mode ?? 'list';
  // In QR mode the lobby's start also opens the rifa (one advance does both), and the snapshot this
  // screen starts from may have been read in the lobby, before that.
  const opened = s0.opened === true || mode === 'qr';
  const [data, setData] = useState<HostData>(() => ({
    entries: s0.entries ?? [],
    winners: s0.winners ?? [],
    rounds: s0.rounds ?? 0,
    round: s0.round ?? null,
  }));
  const [onOverboard, setOnOverboard] = useState<OnOverboard>(s0.onOverboard ?? 'return');
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [failed, setFailed] = useState(false);
  const [bagFailed, setBagFailed] = useState(false);
  // Time comes from the client clock: the server render and hydration must not depend on it. The
  // first timed render comes after mount, once the frame's own effects have synced the clock.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const first = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(first);
  }, []);

  // Every event once (the hub replays its buffer on each subscribe), kept in order to replay it
  // over a bag fetch that was in flight meanwhile.
  const log = useRef<RifaEvent[]>([]);
  const seen = useRef(new WeakSet<object>());
  // Changes of "al agua" this screen is saving, and how many it started: what the server says about
  // the choice meanwhile (a round, a bag reply) may predate them.
  const saving = useRef(0);
  const toggles = useRef(0);
  // The newest round this screen knows of, from an event or a bag reply: an older round's choice is stale.
  const latestRound = useRef(s0.rounds ?? 0);
  useEffect(
    () =>
      subscribe((event) => {
        const e = event as RifaEvent;
        if ((e.type !== 'rifa.round' && e.type !== 'rifa.bag') || seen.current.has(e)) return;
        seen.current.add(e);
        log.current.push(e);
        setData((d) => applyHostEvent(d, e));
        // Another presenter screen may have changed it: a new round says what the server had.
        if (e.type === 'rifa.round' && e.round.n > latestRound.current) {
          latestRound.current = e.round.n;
          if (saving.current === 0) setOnOverboard(e.round.onOverboard);
        }
      }),
    [subscribe],
  );

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // One fetch at a time; a request that comes in meanwhile runs once more afterwards. A failed one
  // is retried with backoff, then the screen offers to try again.
  const fetching = useRef(false);
  const again = useRef(false);
  const refresh = useCallback(async () => {
    if (fetching.current) {
      again.current = true;
      return;
    }
    fetching.current = true;
    try {
      let failures = 0;
      do {
        again.current = false;
        const from = log.current.length;
        const toggled = toggles.current;
        try {
          const reply = (await hostAction('bag')) as BagReply;
          const missed = log.current.slice(from);
          failures = 0;
          setBagFailed(false);
          setData((d) => applyBagReply(d, reply, missed));
          const current = reply.rounds >= latestRound.current;
          latestRound.current = Math.max(latestRound.current, reply.rounds);
          if (current && reply.onOverboard && toggles.current === toggled && saving.current === 0) setOnOverboard(reply.onOverboard);
        } catch (error) {
          console.error('rifa: loading the bag failed', error);
          failures++;
          if (failures <= FETCH_RETRIES) again.current = true;
          else setBagFailed(true);
        }
        if (again.current) await sleep(failures > 0 ? RETRY_MS * 2 ** (failures - 1) : REFETCH_GAP_MS);
      } while (again.current && alive.current);
    } finally {
      fetching.current = false;
    }
  }, [hostAction]);

  // New players join the bag; the frame only tells us how many there are.
  useEffect(() => {
    if (mode === 'qr') void refresh();
  }, [mode, playerCount, refresh]);

  const act = useCallback(
    async (name: string, args?: unknown): Promise<unknown> => {
      try {
        const result = await hostAction(name, args);
        setFailed(false);
        return result;
      } catch (error) {
        // Usually another presenter changed the rifa first: reload the bag and let them try again.
        console.error(`rifa: ${name} failed`, error);
        setFailed(true);
        void refresh();
        return undefined;
      }
    },
    [hostAction, refresh],
  );

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), FAILED_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  // The chip changes when the server's rifa.bag event comes back.
  const toggle = (entry: BagEntry) => {
    if (entry.status === 'won' || busy.has(entry.id)) return;
    setBusy((b) => new Set(b).add(entry.id));
    void act(entry.status === 'bag' ? 'discard' : 'restore', { entryId: entry.id }).finally(() =>
      setBusy((b) => {
        const next = new Set(b);
        next.delete(entry.id);
        return next;
      }),
    );
  };

  const changeOnOverboard = async (value: OnOverboard) => {
    const before = onOverboard;
    setOnOverboard(value);
    toggles.current++;
    saving.current++;
    try {
      const result = (await act('setOnOverboard', { value })) as { onOverboard?: OnOverboard } | undefined;
      setOnOverboard(result?.onOverboard ?? before);
    } finally {
      saving.current--;
    }
  };

  const reset = () => {
    if (confirm(t('confirmReset'))) void act('reset');
  };

  // Until then time stands before the round: nothing of it is revealed, on the server or while hydrating.
  const now = ready ? clock.now() : Number.NEGATIVE_INFINITY;
  const playing = data.round !== null && now < data.round.endsAt;
  const shown = visibleEntries(data.entries, data.round, now);
  // QR players come in no useful order: alphabetical, so the presenter can find a name.
  const chips = mode === 'qr' ? [...shown].sort(byName) : shown;
  const inBag = shown.filter((e) => e.status === 'bag').length;
  const winners = visibleWinners(data.winners, data.round, now);
  const advance = advanceState({ opened, round: data.round, inBag }, now);
  // After a reset the stage waits for the next round instead of showing the last winner.
  const stageRound = data.round && (playing || data.winners[data.winners.length - 1]?.kind !== 'reset') ? data.round : null;
  const { caption, announce } = useCaption(stageRound, now);

  // Re-render when the next step starts or is revealed, and when the round ends; not before mount.
  useRoundTicker(data.round, clock, ready);

  const label = t(`advance.${advance.label}`);
  useEffect(() => setAdvanceLabel(label), [label, setAdvanceLabel]);
  useEffect(() => setAdvanceDisabled(advance.disabled), [advance.disabled, setAdvanceDisabled]);
  useEffect(() => () => setAdvanceDisabled(false), [setAdvanceDisabled]);
  const subtitle = data.rounds > 0 ? t('subtitle', { round: data.rounds, count: inBag }) : t('subtitleStart', { count: inBag });
  useEffect(() => setSubtitle(subtitle), [subtitle, setSubtitle]);

  // The frame advances on Space anywhere on the page; on one of these buttons Space presses the
  // button instead (a draw can't be undone). The clicker keys still advance.
  const keepSpace = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' && e.target instanceof HTMLButtonElement) e.stopPropagation();
  };
  // After a mouse or touch press, let go of the focus so Space draws again.
  const dropFocus = (e: MouseEvent<HTMLDivElement>) => {
    if (e.detail > 0 && e.target instanceof Element) e.target.closest('button')?.blur();
  };

  return (
    <div className="flex flex-1 flex-col gap-4 lg:gap-5" onKeyDown={keepSpace} onClick={dropFocus}>
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
        <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-3xl p-3 lg:p-5" style={{ background: STAGE_BG }}>
          {caption && (
            <p aria-hidden="true" className="rounded-full bg-noche/70 px-4 py-1 font-display text-lg font-bold lg:absolute lg:top-5 lg:left-5 lg:text-xl">
              {caption}
            </p>
          )}
          <div className="w-full max-w-[min(100%,calc(46dvh*4/3))]">
            {stageRound ? <ScenePlayer round={stageRound} clock={clock} /> : <ReadyStage />}
          </div>
          <p aria-live="polite" className="sr-only">
            {announce}
          </p>
        </div>
        <div className="relative lg:w-80 lg:shrink-0 xl:w-96">
          <div className="lg:absolute lg:inset-0">
            <WinnersList winners={winners} />
          </div>
        </div>
      </div>
      {bagFailed && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-tajibo/40 bg-tajibo/15 px-4 py-2">
          <p className="text-[#ff9cc0]">{t('bagFailed')}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex min-h-11 items-center rounded-xl px-4 font-semibold text-blanco transition-colors hover:bg-noche-2"
          >
            {t('retry')}
          </button>
        </div>
      )}
      <div className="max-h-[50dvh] overflow-y-auto rounded-3xl bg-noche-2/40 p-3 lg:max-h-[24dvh] lg:p-4">
        <BagChips entries={chips} busy={busy} onToggle={toggle} />
      </div>
      <Controls
        onOverboard={onOverboard}
        onOverboardChange={changeOnOverboard}
        onReset={reset}
        resetDisabled={playing || shown.every((e) => e.status === 'bag')}
        failed={failed}
      />
    </div>
  );
}
