'use client';

import { useTranslations } from 'next-intl';
import { createContext, useContext, useId, useMemo, type CSSProperties, type ReactNode } from 'react';

/** Builds the id of a def inside one stage, so two players on a page never share ids. */
export type SvgIds = (name: string) => string;

const IdsContext = createContext<SvgIds>((name) => `rifa-${name}`);

export function useSvgIds(): SvgIds {
  const raw = useId();
  return useMemo(() => {
    const prefix = `rifa${raw.replace(/[^\w-]/g, '')}`;
    return (name: string) => `${prefix}-${name}`;
  }, [raw]);
}

/** Ids of the stage this component is drawn in. */
export function useStageIds(): SvgIds {
  return useContext(IdsContext);
}

/** One scene drawing: 400×300, announced by `label`. */
export function Stage({ ids, label, children }: { ids: SvgIds; label: string; children: ReactNode }) {
  return (
    <IdsContext.Provider value={ids}>
      <svg className="rifa-svg" viewBox="0 0 400 300" role="img" aria-label={label}>
        {children}
      </svg>
    </IdsContext.Provider>
  );
}

/** Custom properties for a `style` prop. */
export function vars(values: Record<string, string>): CSSProperties {
  return values as CSSProperties;
}

/** Starts a one-shot animation at a fraction of the scene, still shifted by `--rifa-t0`. */
export function at(fraction: number): CSSProperties {
  return { animationDelay: `calc(var(--rifa-T) * ${fraction} + var(--rifa-t0, 0ms))` };
}

/**
 * A looping animation that keeps going for as long as the scene is on screen. Until its delay
 * passes it holds its first keyframe, so nothing waits at its untransformed spot (e.g. confetti at 0,0).
 */
export function loop(animation: string, extra?: Record<string, string>): CSSProperties {
  return { ...extra, animation: `${animation} backwards` } as CSSProperties;
}

/** The "¡Al agua!" banner that closes every scene; `still` shows it without the pop. */
export function AlAgua({ still = false }: { still?: boolean }) {
  const t = useTranslations('rifa.scenes');
  return (
    <g transform="translate(200 40)">
      <g className={still ? undefined : 'rifa-a rifa-cap'}>
        <rect x={-80} y={-24} width={160} height={44} rx={12} fill="#d63a72" />
        <text y={10} textAnchor="middle" fontSize={26} fill="#fbf8ff">
          {t('alAgua')}
        </text>
      </g>
    </g>
  );
}

/** A few night stars; `twinkle` makes them blink. */
export function Stars({ points, twinkle = true }: { points: [number, number, number, string, string][]; twinkle?: boolean }) {
  return (
    <g fill="#fbf8ff">
      {points.map(([cx, cy, r, period, delay]) => (
        <circle
          key={`${cx}-${cy}`}
          className={twinkle ? 'rifa-loop' : undefined}
          cx={cx}
          cy={cy}
          r={r}
          style={twinkle ? loop(`rifa-twinkle ${period} ease-in-out infinite ${delay}`) : undefined}
        />
      ))}
    </g>
  );
}
