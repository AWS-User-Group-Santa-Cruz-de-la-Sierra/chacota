'use client';

import { useTranslations } from 'next-intl';
import { Duende, DuendeDefs, DuendeHat, NameTag } from './duende';
import { AlAgua, at, loop, Stage, useSvgIds, vars } from './stage';

const INK = '#1e293b';
const WAVE = `M212 256 q10 -5 20 0${' t20 0'.repeat(19)}`;

const SPLASHES: [number, number, number][] = [
  [-40, -50, 7],
  [-10, -70, 6],
  [30, -60, 8],
  [56, -30, 5],
];

/** A caiman jumps out of the river, grabs the duende and drags it in; the hat and the sign float up. */
export function LagartoScene({ name }: { name: string }) {
  const t = useTranslations('rifa.scenes');
  const id = useSvgIds();
  return (
    <Stage ids={id} label={t('labels.lagarto', { name })}>
      <DuendeDefs />
      <defs>
        <clipPath id={id('river')}>
          <rect x="212" y="240" width="188" height="60" />
        </clipPath>
      </defs>
      <rect width="400" height="300" fill="#1a0e2e" />
      <circle cx="330" cy="52" r="22" fill="#fde68a" opacity=".85" />
      <path d="M0 150 Q60 120 120 140 T240 135 T400 130 V250 H0Z" fill="#14532d" opacity=".55" />
      <rect x="200" y="242" width="200" height="58" fill="#0c4a6e" />
      {/* the bank */}
      <path d="M0 250 H200 Q218 252 224 268 Q228 290 236 300 H0Z" fill="#6b4423" />
      <path d="M0 250 H200 Q210 251 214 256 H0Z" fill="#16a34a" />
      <g stroke="#16a34a" strokeWidth="3" strokeLinecap="round">
        <path d="M30 252 l-4 -14 M36 252 l2 -16 M42 252 l6 -12" />
        <path d="M110 252 l-3 -12 M116 252 l3 -15" />
      </g>
      <Duende name={name} x={160} y={250} scale={0.45} className="rifa-a rifa-s3-duende" loop="rifa-bob 1.8s ease-in-out infinite" />
      {/* the caiman */}
      <g transform="translate(330 268)">
        <g className="rifa-a rifa-s3-croc">
          <path d="M6 -10 q12 -14 24 0 q12 -14 24 0 q12 -14 24 0" fill="#3f6212" stroke={INK} strokeWidth="2.5" />
          <path d="M8 2 L-106 6 Q-118 8 -112 15 L-20 19 Q10 17 8 2Z" fill="#4d7c0f" stroke={INK} strokeWidth="3" />
          <path d="M-100 7 l5 -7 l5 7 l5 -7 l5 7 l5 -7 l5 7 l5 -7 l5 7" fill="#fff" stroke={INK} strokeWidth="1.2" />
          <g transform="translate(0 -2)">
            <g className="rifa-a rifa-s3-jaw">
              <g transform="translate(0 2)">
                <path d="M12 -2 Q4 -32 -28 -32 Q-62 -28 -92 -18 Q-116 -13 -118 -3 Q-116 3 -102 3 L10 1Z" fill="#65a30d" stroke={INK} strokeWidth="3" />
                <path d="M-104 3 l5 7 l5 -7 l5 7 l5 -7 l5 7 l5 -7 l5 7 l5 -7 l5 7 l5 -7" fill="#fff" stroke={INK} strokeWidth="1.2" />
                <circle cx="-108" cy="-12" r="3" fill={INK} />
                <circle cx="-14" cy="-31" r="11" fill="#65a30d" stroke={INK} strokeWidth="3" />
                <circle cx="-14" cy="-32" r="6" fill="#fde047" />
                <rect x="-15.5" y="-37" width="3" height="10" rx="1.5" fill="#111" />
                <circle cx="-36" cy="-29" r="8" fill="#65a30d" stroke={INK} strokeWidth="2.5" />
                <circle cx="-36" cy="-30" r="4" fill="#fde047" />
                <rect x="-37" y="-33" width="2" height="7" rx="1" fill="#111" />
              </g>
            </g>
          </g>
        </g>
      </g>
      {/* hat and sign floating; the sign rides high enough to read the name */}
      <g transform="translate(300 252) scale(.3)">
        <g className="rifa-a rifa-s3-float">
          <DuendeHat y={-190} />
        </g>
      </g>
      <g transform="translate(358 242) scale(.7)">
        <g className="rifa-a rifa-s3-float" style={at(0.04)}>
          <g transform="rotate(-10)">
            <NameTag name={name} loose />
          </g>
        </g>
      </g>
      {/* water in front */}
      <rect x="212" y="252" width="188" height="48" fill="#0369a1" opacity=".93" />
      <g clipPath={`url(#${id('river')})`}>
        <g className="rifa-loop" style={loop('rifa-wave 3s linear infinite')}>
          <path d={WAVE} fill="none" stroke="#7dd3fc" strokeWidth="2.5" opacity=".8" />
        </g>
      </g>
      <rect x="200" y="252" width="12" height="48" fill="#6b4423" />
      {/* splash, ripples and bubbles */}
      <g transform="translate(250 252)" fill="#7dd3fc">
        {SPLASHES.map(([dx, dy, r]) => (
          <circle key={dx} className="rifa-a rifa-splash" r={r} style={{ ...vars({ '--dx': `${dx}px`, '--dy': `${dy}px` }), ...at(0.5) }} />
        ))}
      </g>
      <g transform="translate(275 262) scale(1 .3)">
        <circle className="rifa-a rifa-ripple" r="40" fill="none" stroke="#bae6fd" strokeWidth="5" style={at(0.56)} />
        <circle className="rifa-a rifa-ripple" r="40" fill="none" stroke="#bae6fd" strokeWidth="4" style={at(0.62)} />
      </g>
      <g transform="translate(280 270)">
        <circle className="rifa-a rifa-rise" r="5" fill="none" stroke="#e0f2fe" strokeWidth="2" style={{ ...vars({ '--x': '-10px' }), ...at(0.6) }} />
        <circle className="rifa-a rifa-rise" r="4" fill="none" stroke="#e0f2fe" strokeWidth="2" style={{ ...vars({ '--x': '8px' }), ...at(0.64) }} />
      </g>
      <AlAgua />
    </Stage>
  );
}
