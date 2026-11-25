'use client';

import type { Clock } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useState, type CSSProperties } from 'react';
import type { OnOverboard } from '../model';

/**
 * The rise plays once from the moment the scene ended; `--rifa-t0` (a negative delay) lets a phone
 * that comes back later land where it should, usually with the water already up.
 */
const FLOOD_STYLES = `
.rifa-flood-water { background: linear-gradient(#38bdf8cc, #0369a1); transform: translateY(12%); animation: rifa-flood-rise 3s cubic-bezier(.3, 0, .3, 1) both; animation-delay: calc(300ms + var(--rifa-t0, 0ms)); }
.rifa-flood-wave { animation: rifa-flood-wave 1.6s linear infinite; }
.rifa-flood-tag { transform: rotate(-4deg); animation: rifa-flood-bob 1.8s ease-in-out infinite; }
.rifa-flood-bub { opacity: 0; animation: rifa-flood-bub 2.2s ease-in infinite backwards; }
.rifa-flood-oops { animation: rifa-flood-pop 400ms cubic-bezier(.3, 1.6, .6, 1) both; animation-delay: var(--rifa-t0, 0ms); }
.rifa-flood-under { animation: rifa-flood-under 500ms ease-out both; animation-delay: calc(3200ms + var(--rifa-t0, 0ms)); }
@keyframes rifa-flood-rise { from { transform: translateY(100%); } to { transform: translateY(12%); } }
@keyframes rifa-flood-wave { to { transform: translateX(-200px); } }
@keyframes rifa-flood-bob { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(5px) rotate(4deg); } }
@keyframes rifa-flood-bub { 0% { transform: translateY(0); opacity: 0; } 10% { opacity: .9; } 100% { transform: translateY(-300px); opacity: 0; } }
@keyframes rifa-flood-pop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes rifa-flood-under { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .rifa-flood-water, .rifa-flood-wave, .rifa-flood-tag, .rifa-flood-oops, .rifa-flood-under { animation: none; }
  .rifa-flood-bub { display: none; }
}
`;

// Two crests per 200 px, so sliding it 200 px loops without a seam; wide enough for any phone.
const WAVE = `M0 8 q25 -8 50 0${' t50 0'.repeat(15)} V16 H0Z`;

/** Left (%), and delay (ms) after the reveal: the bubbles start once the water is up. */
const BUBBLES: [number, number][] = [
  [15, 3_400],
  [60, 4_200],
  [40, 4_800],
  [80, 3_900],
  [28, 5_300],
];

/**
 * The phone of one who went overboard, once their scene ended: the water rises with a wave and
 * bubbles, their sign floats on the surface and the line under it says what happens to them.
 */
export function Flood({ name, onOverboard, since, clock }: { name: string; onOverboard: OnOverboard; since: number; clock: Clock }) {
  const t = useTranslations('rifa.play.flood');
  // Frozen at mount, so re-renders never restart the rise.
  const [t0] = useState(() => Math.max(0, clock.now() - since));

  return (
    <div
      className="relative isolate flex min-h-[22rem] flex-1 overflow-hidden rounded-3xl bg-noche-2/60"
      style={{ '--rifa-t0': `${-t0}ms` } as CSSProperties}
    >
      <style href="rifa-flood" precedence="default">
        {FLOOD_STYLES}
      </style>
      <p aria-hidden="true" className="rifa-flood-oops absolute inset-x-0 top-[16%] text-center font-display text-5xl font-extrabold">
        {t('oops')}
      </p>
      <div aria-hidden="true" className="rifa-flood-water absolute inset-x-0 top-0 z-10 h-full">
        <svg className="rifa-flood-wave absolute -top-3.5 left-0 h-4 w-[800px] max-w-none" viewBox="0 0 800 16" preserveAspectRatio="none">
          <path d={WAVE} fill="#38bdf8cc" />
        </svg>
        <div className="absolute inset-x-0 -top-6 flex justify-center">
          {/* A block, not flex, so a long name ends in an ellipsis; 34 px is the height inside the border. */}
          <span className="rifa-flood-tag block h-10 max-w-[85%] truncate rounded-md border-[3px] border-[#78350F] bg-[#E9C98F] px-3 font-display text-lg leading-[34px] font-extrabold text-[#78350F]">
            {name}
          </span>
        </div>
      </div>
      {BUBBLES.map(([left, delay]) => (
        <span
          key={left}
          aria-hidden="true"
          className="rifa-flood-bub absolute bottom-0 z-20 size-2.5 rounded-full border-2 border-[#e0f2fe]"
          style={{ left: `${left}%`, animationDelay: `calc(${delay}ms + var(--rifa-t0, 0ms))` }}
        />
      ))}
      <div className="rifa-flood-under absolute inset-x-4 top-[46%] z-30 text-center">
        <p className="font-display text-3xl font-extrabold text-balance text-blanco [text-shadow:0_2px_10px_#0369a1]">{t('title')}</p>
        {/* Bold at 20 px counts as large text: it reads over the lighter water. */}
        <p className="mt-1 text-xl font-bold text-[#e0f2fe] [text-shadow:0_1px_6px_#0369a1]">{t(onOverboard)}</p>
      </div>
    </div>
  );
}
