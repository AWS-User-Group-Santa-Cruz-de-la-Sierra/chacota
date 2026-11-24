'use client';

import type { Clock } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useEffect, useReducer, useState, type ComponentType } from 'react';
import { SCENE_MS, WINNER_MS, type Round, type Scene } from '../model';
import { stepAt, type Step } from '../timeline';
import { GlobazoScene } from './scenes/globazo';
import { LagartoScene } from './scenes/lagarto';
import { Micro72Scene } from './scenes/micro72';
import { ReducedOutScene } from './scenes/reduced';
import { RetreteScene } from './scenes/retrete';
import { Stage, Stars, useSvgIds, vars } from './scenes/stage';
import { SCENE_STYLES } from './scenes/styles';
import { WinnerScene } from './scenes/winner';

const SCENE_VIEWS: Record<Scene, ComponentType<{ name: string }>> = {
  retrete: RetreteScene,
  globazo: GlobazoScene,
  lagarto: LagartoScene,
  micro72: Micro72Scene,
};

const IDLE_STARS: [number, number, number, string, string][] = [
  [40, 30, 1.6, '2.2s', '0s'],
  [120, 50, 1.2, '2.8s', '.3s'],
  [250, 26, 1.4, '2.4s', '.9s'],
  [330, 22, 1.4, '3s', '.6s'],
  [370, 70, 1.8, '2.6s', '1.1s'],
];

/** Start times of every step, then the end of the round. */
function boundaries(round: Round): number[] {
  return [...round.out.map((o) => o.startsAt), round.winner.startsAt, round.endsAt];
}

function stepKey(round: Round, step: Step): string {
  const base = `${round.winner.startsAt}`;
  return step.kind === 'out' ? `${base}:out:${step.index}` : `${base}:${step.kind}`;
}

function IdleStage() {
  const t = useTranslations('rifa.scenes');
  const id = useSvgIds();
  return (
    <Stage ids={id} label={t('labels.waiting')}>
      <rect width="400" height="300" fill="#1a0e2e" />
      <Stars points={IDLE_STARS} />
    </Stage>
  );
}

/** One step, mounted fresh for each: its clock offset is frozen at mount so re-renders never shift it. */
function StepView({ round, step }: { round: Round; step: Step }) {
  const [t0] = useState(() => ('elapsed' in step ? step.elapsed : 0));
  if (step.kind === 'waiting') return <IdleStage />;
  if (step.kind === 'done') {
    return (
      <div className="rifa-still">
        <WinnerScene name={round.winner.name} />
      </div>
    );
  }
  const timing = (ms: number) => vars({ '--rifa-T': `${ms}ms`, '--rifa-t0': `${-t0}ms` });
  if (step.kind === 'winner') {
    return (
      <div style={timing(WINNER_MS)}>
        <WinnerScene name={round.winner.name} />
      </div>
    );
  }
  const out = round.out[step.index]!;
  const View = SCENE_VIEWS[out.scene];
  return (
    <div style={timing(SCENE_MS[out.scene])}>
      <div className="rifa-full">
        <View name={out.name} />
      </div>
      <div className="rifa-reduced">
        <ReducedOutScene name={out.name} />
      </div>
    </div>
  );
}

/**
 * Plays a round in sync with the server clock: each "al agua" scene in turn, then the winner,
 * then the winner standing still. Re-renders only at step boundaries.
 */
export function ScenePlayer({ round, clock, compact = false }: { round: Round; clock: Clock; compact?: boolean }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const step = stepAt(round, clock.now());

  useEffect(() => {
    const now = clock.now();
    const next = boundaries(round).find((b) => b > now);
    if (next === undefined) return;
    // A little past the boundary, so the next render lands inside the new step.
    const timer = setTimeout(rerender, next - now + 20);
    return () => clearTimeout(timer);
  });

  return (
    <div className={compact ? 'rifa-stage rifa-stage-compact' : 'rifa-stage'}>
      <style href="rifa-scenes" precedence="default">
        {SCENE_STYLES}
      </style>
      <StepView key={stepKey(round, step)} round={round} step={step} />
    </div>
  );
}
