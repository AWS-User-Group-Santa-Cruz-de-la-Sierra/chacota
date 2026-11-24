'use client';

import { useTranslations } from 'next-intl';
import { NameTag } from './duende';
import { AlAgua, at, loop, Stage, useSvgIds, vars } from './stage';

const BUBBLES: [number, number, number][] = [
  [-14, 5, 0.79],
  [6, 4, 0.82],
  [18, 6, 0.85],
];

/** The sign falls into the bowl, someone flushes, and it spirals down the drain. */
export function RetreteScene({ name }: { name: string }) {
  const t = useTranslations('rifa.scenes');
  const id = useSvgIds();
  return (
    <Stage ids={id} label={t('labels.retrete', { name })}>
      <defs>
        <pattern id={id('tiles')} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#241640" />
          <path d="M40 0H0V40" fill="none" stroke="#2f1f52" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill={`url(#${id('tiles')})`} />
      {/* tank and handle */}
      <rect x="135" y="30" width="130" height="56" rx="12" fill="#f1f5f9" stroke="#1e293b" strokeWidth="4" />
      <g transform="translate(150 50)">
        <g className="rifa-a rifa-s1-handle">
          <rect x="-26" y="-5" width="30" height="10" rx="5" fill="#94a3b8" stroke="#1e293b" strokeWidth="3" />
        </g>
      </g>
      {/* bowl seen from above */}
      <ellipse cx="200" cy="185" rx="118" ry="92" fill="#f8fafc" stroke="#1e293b" strokeWidth="4" />
      <ellipse cx="200" cy="185" rx="100" ry="76" fill="none" stroke="#e2e8f0" strokeWidth="14" />
      <ellipse cx="200" cy="188" rx="76" ry="55" fill="#7dd3fc" stroke="#38bdf8" strokeWidth="3" />
      <g transform="translate(200 188) scale(1 .72)">
        <g className="rifa-loop" style={loop('rifa-spin 5s linear infinite')}>
          <circle r="50" fill="none" stroke="#e0f2fe" strokeWidth="3" strokeDasharray="30 22" opacity=".7" />
          <circle r="28" fill="none" stroke="#e0f2fe" strokeWidth="3" strokeDasharray="18 14" opacity=".6" />
        </g>
        <g className="rifa-a rifa-s1-rush">
          <g className="rifa-loop" style={loop('rifa-spin .7s linear infinite')}>
            <circle r="62" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="40 18" opacity=".8" />
            <circle r="40" fill="none" stroke="#bae6fd" strokeWidth="5" strokeDasharray="24 12" />
            <circle r="18" fill="#0ea5e9" opacity=".6" />
          </g>
        </g>
        {/* the sign drops, spins and drains */}
        <g className="rifa-a rifa-s1-drop">
          <g className="rifa-a rifa-s1-spin">
            <g className="rifa-a rifa-s1-drain">
              <NameTag name={name} loose />
            </g>
          </g>
        </g>
      </g>
      <g transform="translate(200 190)">
        {BUBBLES.map(([x, r, f]) => (
          <circle
            key={x}
            className="rifa-a rifa-rise"
            r={r}
            fill="none"
            stroke="#e0f2fe"
            strokeWidth="2"
            style={{ ...vars({ '--x': `${x}px` }), ...at(f) }}
          />
        ))}
      </g>
      <AlAgua />
    </Stage>
  );
}
