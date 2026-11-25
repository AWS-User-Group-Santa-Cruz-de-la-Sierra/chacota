'use client';

import { useTranslations } from 'next-intl';
import { Duende, DuendeDefs } from './duende';
import { AlAgua, at, loop, Stage, useSvgIds, vars } from './stage';

/** Rain streaks under the cloud: [x, period, delay]. */
const RAIN: [number, string, string][] = [
  [-60, '.35s', '0s'], [-40, '.3s', '.1s'], [-20, '.33s', '.05s'], [0, '.28s', '.15s'], [20, '.34s', '0s'],
  [40, '.31s', '.12s'], [60, '.29s', '.07s'], [-50, '.32s', '.2s'], [10, '.3s', '.22s'], [50, '.33s', '.17s'],
];

const SPLASHES: [number, number, number, number][] = [
  [-30, -60, 7, 0.75],
  [-60, -40, 6, 0.75],
  [-10, -80, 8, 0.75],
  [-80, -20, 6, 0.75],
  [-45, -75, 5, 0.76],
];

function Wheel({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} -14)`}>
      <g className="rifa-loop" style={loop('rifa-spin .4s linear infinite')}>
        <circle r="15" fill="#111" stroke="#475569" strokeWidth="3" />
        <path d="M-9 0 H9 M0 -9 V9" stroke="#94a3b8" strokeWidth="3" />
      </g>
    </g>
  );
}

/** The duende waits for bus 72, a downpour knocks it over, and the bus splashes it and drives on. */
export function Micro72Scene({ name }: { name: string }) {
  const t = useTranslations('rifa.scenes');
  const id = useSvgIds();
  const stop = t('stop');
  return (
    <Stage ids={id} label={t('labels.micro72', { name })}>
      <DuendeDefs />
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140a26" />
          <stop offset="1" stopColor="#3d2a5c" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id('sky')})`} />
      <g fill="#2b1a47">
        <rect x="0" y="120" width="70" height="110" />
        <rect x="74" y="90" width="50" height="140" />
        <rect x="250" y="100" width="64" height="130" />
        <rect x="318" y="130" width="82" height="100" />
      </g>
      <g fill="#ffc629">
        <rect className="rifa-loop" x="12" y="134" width="8" height="10" style={loop('rifa-twinkle 3s ease-in-out infinite')} />
        <rect x="40" y="160" width="8" height="10" opacity=".7" />
        <rect className="rifa-loop" x="86" y="110" width="8" height="10" style={loop('rifa-twinkle 2.4s ease-in-out infinite .8s')} />
        <rect x="264" y="120" width="8" height="10" opacity=".7" />
        <rect className="rifa-loop" x="290" y="150" width="8" height="10" style={loop('rifa-twinkle 3.4s ease-in-out infinite .4s')} />
        <rect x="340" y="146" width="8" height="10" opacity=".6" />
      </g>
      {/* sidewalk and street */}
      <rect x="0" y="228" width="400" height="22" fill="#4b3a6b" />
      <rect x="0" y="246" width="400" height="4" fill="#cfc3e6" opacity=".5" />
      <rect x="0" y="250" width="400" height="50" fill="#21183a" />
      <path d="M0 280 H400" stroke="#fbf8ff" strokeWidth="3" strokeDasharray="22 18" opacity=".55" />
      {/* bus stop */}
      <rect x="108" y="118" width="5" height="112" fill="#94a3b8" />
      <rect x="86" y="96" width="50" height="16" rx="4" fill="#fbf8ff" />
      <text
        x="111"
        y="108"
        textAnchor="middle"
        fontSize="10"
        fill="#1a0e2e"
        textLength={stop.length > 6 ? 44 : undefined}
        lengthAdjust={stop.length > 6 ? 'spacingAndGlyphs' : undefined}
      >
        {stop}
      </text>
      <rect x="90" y="114" width="42" height="34" rx="6" fill="#0b8048" stroke="#fbf8ff" strokeWidth="2" />
      <text x="111" y="139" textAnchor="middle" fontSize="22" fill="#fbf8ff">
        72
      </text>
      {/* puddle */}
      <g transform="translate(180 254)">
        <g className="rifa-a rifa-s4-puddle">
          <ellipse rx="60" ry="7" fill="#38bdf8" opacity=".55" />
        </g>
      </g>
      <Duende name={name} x={170} y={238} scale={0.4} className="rifa-a rifa-s4-duende" />
      {/* cloud and downpour */}
      <g transform="translate(175 58)">
        <g className="rifa-a rifa-s4-cloud">
          <g className="rifa-a rifa-s4-rainvis">
            <g stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="12 36">
              {RAIN.map(([x, period, delay]) => (
                <line key={x} className="rifa-loop" x1={x} y1="10" x2={x - 6} y2="180" style={loop(`rifa-rain ${period} linear infinite ${delay}`)} />
              ))}
            </g>
          </g>
          <g fill="#475569" stroke="#1e293b" strokeWidth="3">
            <ellipse cx="-40" cy="0" rx="40" ry="26" />
            <ellipse cx="10" cy="-14" rx="48" ry="34" />
            <ellipse cx="54" cy="2" rx="36" ry="24" />
          </g>
          <path d="M-70 14 H84" stroke="#334155" strokeWidth="12" strokeLinecap="round" />
        </g>
      </g>
      {/* bus 72: white with a blue and a red stripe */}
      <g transform="translate(0 296)">
        <g className="rifa-a rifa-s4-bus">
          <rect x="0" y="-98" width="232" height="82" rx="14" fill="#f8fafc" stroke="#1e293b" strokeWidth="3" />
          <g fill="#1e3a5f">
            <rect x="44" y="-90" width="28" height="26" rx="4" />
            <rect x="78" y="-90" width="28" height="26" rx="4" />
            <rect x="112" y="-90" width="28" height="26" rx="4" />
            <rect x="146" y="-90" width="28" height="26" rx="4" />
            <rect x="206" y="-92" width="22" height="44" rx="6" />
          </g>
          <rect x="12" y="-86" width="24" height="66" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
          <rect x="0" y="-58" width="232" height="7" fill="#1d4ed8" />
          <rect x="0" y="-49" width="232" height="5" fill="#dc2626" />
          <rect x="178" y="-98" width="48" height="10" rx="2" fill="#111" />
          <text x="202" y="-90" textAnchor="middle" fontSize="9" fill="#fbbf24">
            72
          </text>
          <text x="128" y="-22" textAnchor="middle" fontSize="22" fill="#1d4ed8">
            72
          </text>
          <circle cx="228" cy="-30" r="4" fill="#fde047" />
          <Wheel x={52} />
          <Wheel x={186} />
        </g>
      </g>
      {/* speech bubble, in front of the bus so it stays readable */}
      <g transform="translate(70 196)">
        <g className="rifa-a rifa-s4-bubble">
          <path
            d="M-46 -22 h92 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 h-56 l-14 12 l2 -12 h-24 a10 10 0 0 1 -10 -10 v-18 a10 10 0 0 1 10 -10z"
            fill="#fbf8ff"
          />
          <text y="2" textAnchor="middle" fontSize="15" fill="#1a0e2e">
            {t('para72')}
          </text>
        </g>
      </g>
      {/* the bus splashes */}
      <g transform="translate(180 256)" fill="#7dd3fc">
        {SPLASHES.map(([dx, dy, r, f]) => (
          <circle key={dx} className="rifa-a rifa-splash" r={r} style={{ ...vars({ '--dx': `${dx}px`, '--dy': `${dy}px` }), ...at(f) }} />
        ))}
      </g>
      <AlAgua />
    </Stage>
  );
}
