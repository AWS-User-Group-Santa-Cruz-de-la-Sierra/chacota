'use client';

import type { Clock } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useState, type CSSProperties } from 'react';

/**
 * The neon is a CSS text-shadow (no SVG filter): light enough for low-end phones. The entrance
 * plays once from the winner step; `--rifa-t0` (a negative delay) lands a late phone in place.
 */
const WINNER_STYLES = `
.rifa-wp { background: radial-gradient(circle at 50% 42%, #ffc62955, #1a0e2e 62%); }
.rifa-wp-neon { color: #fff7d6; text-shadow: 0 0 6px #ffc629, 0 0 16px #ffc629, 0 0 32px #d63a72, 0 0 54px #d63a72; animation: rifa-wp-neon 1s linear both; animation-delay: calc(400ms + var(--rifa-t0, 0ms)); }
.rifa-wp-crown { animation: rifa-wp-crown 1.1s both; animation-delay: calc(1000ms + var(--rifa-t0, 0ms)); }
.rifa-wp-after { animation: rifa-wp-after 400ms cubic-bezier(.3, 1.4, .6, 1) both; animation-delay: calc(1900ms + var(--rifa-t0, 0ms)); }
.rifa-wp-gold { position: absolute; top: -10px; width: 7px; height: 7px; border-radius: 2px; animation: rifa-wp-gold 3s linear infinite backwards; }
@keyframes rifa-wp-neon { 0% { opacity: 0; } 20% { opacity: 1; } 30% { opacity: .2; } 45% { opacity: 1; } 55% { opacity: .4; } 75%, 100% { opacity: 1; } }
@keyframes rifa-wp-crown {
  0% { transform: translateY(-160px) rotate(-14deg); opacity: 0; animation-timing-function: cubic-bezier(.5, 0, 1, 1); }
  8% { opacity: 1; }
  45% { transform: translateY(0) rotate(0); animation-timing-function: cubic-bezier(0, 0, .4, 1); }
  62% { transform: translateY(-12px) rotate(3deg); animation-timing-function: cubic-bezier(.6, 0, 1, 1); }
  80%, 100% { transform: translateY(0) rotate(0); opacity: 1; }
}
@keyframes rifa-wp-after { from { transform: scale(.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes rifa-wp-gold { from { transform: translateY(0) rotate(0); } to { transform: translateY(100svh) rotate(600deg); } }
@media (prefers-reduced-motion: reduce) {
  .rifa-wp-neon, .rifa-wp-crown, .rifa-wp-after { animation: none; }
  .rifa-wp-gold { display: none; }
}
`;

/** Left (%), delay (ms) after the winner step starts, fall time (ms) and color: the rain starts as the crown lands. */
const GOLD: [number, number, number, string][] = [
  [8, 2_200, 3_000, '#ffc629'],
  [20, 2_900, 3_400, '#d63a72'],
  [33, 2_500, 2_800, '#ffc629'],
  [45, 3_300, 3_200, '#fbf8ff'],
  [56, 2_700, 3_000, '#ffc629'],
  [67, 3_600, 2_900, '#d63a72'],
  [78, 2_400, 3_300, '#ffc629'],
  [90, 3_100, 3_000, '#fbf8ff'],
];

/** About 0.75 em per glyph of the display font in bold, so the name keeps to one line when it can. */
function neonSize(name: string): string {
  const chars = Math.max(1, Array.from(name.trim()).length);
  return `min(3rem, calc(min(100vw - 2rem, 28rem) * 1.3 / ${chars}))`;
}

/** The winner's phone: their name lights up in neon, a gold crown drops and bounces, gold rains. */
export function WinnerPhone({ name, since, clock }: { name: string; since: number; clock: Clock }) {
  const t = useTranslations('rifa.play.won');
  // Frozen at mount, so re-renders never restart the entrance.
  const [t0] = useState(() => Math.max(0, clock.now() - since));

  return (
    <div
      className="rifa-wp relative isolate flex min-h-[22rem] flex-1 flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl px-4 text-center"
      style={{ '--rifa-t0': `${-t0}ms` } as CSSProperties}
    >
      <style href="rifa-winner-phone" precedence="default">
        {WINNER_STYLES}
      </style>
      {GOLD.map(([left, delay, fall, color]) => (
        <span
          key={left}
          aria-hidden="true"
          className="rifa-wp-gold"
          style={{ left: `${left}%`, background: color, animationDelay: `calc(${delay}ms + var(--rifa-t0, 0ms))`, animationDuration: `${fall}ms` }}
        />
      ))}
      <svg className="rifa-wp-crown w-20" viewBox="-50 -40 100 64" aria-hidden="true">
        <path d="M-38 16 L-46 -22 L-20 -2 L0 -32 L20 -2 L46 -22 L38 16Z" fill="#ffc629" stroke="#b45309" strokeWidth="3" strokeLinejoin="round" />
        <rect x="-39" y="10" width="78" height="10" rx="3" fill="#f59e0b" stroke="#b45309" strokeWidth="2.5" />
        <circle cx="0" cy="-32" r="5" fill="#d63a72" />
        <circle cx="0" cy="4" r="5" fill="#d63a72" />
      </svg>
      <p className="rifa-wp-neon max-w-full py-2 font-display leading-tight font-extrabold [overflow-wrap:anywhere]" style={{ fontSize: neonSize(name) }}>
        {name}
      </p>
      <p className="rifa-wp-after font-display text-2xl font-extrabold tracking-wide text-sol uppercase">{t('title')}</p>
    </div>
  );
}
