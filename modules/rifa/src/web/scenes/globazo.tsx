'use client';

import { useTranslations } from 'next-intl';
import { Duende, DuendeDefs, DuendeHat, NameTag, SignStrings } from './duende';
import { AlAgua, at, loop, Stage, Stars, useSvgIds, vars, type SvgIds } from './stage';

const GREEN = '#0b8048';
const WHITE = '#fbf8ff';
const SOL = '#ffc629';
const TAJIBO = '#d63a72';
const LILA = '#8a5cf0';

/** Bunting along the string: [left x, top y, colour, sway delay]. */
const FLAGS: [number, number, string, string][] = [
  [16, 31, GREEN, '0s'], [41, 36, WHITE, '.2s'], [66, 39, GREEN, '.4s'], [91, 42, SOL, '.6s'], [116, 45, TAJIBO, '.8s'],
  [141, 46, LILA, '1s'], [166, 47, GREEN, '1.2s'], [191, 47, WHITE, '1.4s'], [216, 47, GREEN, '1.6s'], [241, 45, SOL, '1.8s'],
  [266, 43, TAJIBO, '.1s'], [291, 40, LILA, '.3s'], [316, 37, GREEN, '.5s'], [341, 32, WHITE, '.7s'], [366, 28, GREEN, '.9s'],
];

const STREAMERS: [string, string, string][] = [
  ['M88 44 c7 9 -7 18 0 27 c7 9 -7 18 0 27', TAJIBO, '.3s'],
  ['M212 50 c7 9 -7 18 0 27 c7 9 -7 18 0 27 c7 9 -7 18 0 27', SOL, '.9s'],
  ['M330 38 c7 9 -7 18 0 27 c7 9 -7 18 0 27', LILA, '1.5s'],
];

/** Splashes where each balloon bursts: [dx, dy, r, at]. */
const SPLASHES: [number, number, number, number][] = [
  [-50, -30, 6, 0.24], [-40, 20, 5, 0.24], [30, -44, 7, 0.24], [56, 6, 5, 0.24], [-6, -60, 4, 0.24],
  [-60, -20, 7, 0.48], [-30, 40, 6, 0.48], [40, -50, 8, 0.48], [64, 16, 6, 0.48], [4, -70, 5, 0.48],
];

const DRIPS: [number, number, number, string][] = [
  [-120, -170, 7, 'rifa-drip 1s ease-in infinite'],
  [110, -165, 6, 'rifa-drip 1.2s ease-in infinite .4s'],
  [-60, -40, 6, 'rifa-drip .9s ease-in infinite .2s'],
  [70, -30, 7, 'rifa-drip 1.1s ease-in infinite .7s'],
];

const STARS: [number, number, number, string, string][] = [
  [40, 30, 1.6, '2.2s', '0s'],
  [330, 22, 1.4, '3s', '.6s'],
  [370, 70, 1.8, '2.6s', '1.1s'],
  [120, 50, 1.2, '2.8s', '.3s'],
];

/** The chest sign in two halves that get wet, then tear apart and fall. */
function TornSign({ name, id }: { name: string; id: SvgIds }) {
  return (
    <>
      <SignStrings />
      {(['left', 'right'] as const).map((side) => (
        <g key={side} transform="translate(0 -92)">
          <g className={`rifa-a rifa-s2-${side}`}>
            <g transform="translate(0 92)">
              <g clipPath={`url(#${id(`tear-${side}`)})`}>
                <g transform="translate(0 -92)">
                  <NameTag name={name} wet={{ className: 'rifa-a rifa-s2-wet' }} />
                </g>
              </g>
            </g>
          </g>
        </g>
      ))}
    </>
  );
}

function Balloon({ fill, stroke, shine, second = false }: { fill: string; stroke: string; shine: string; second?: boolean }) {
  const delay = second ? at(0.24) : undefined;
  return (
    <g transform="translate(10 170)">
      <g className="rifa-a rifa-s2-bx" style={delay}>
        <g className="rifa-a rifa-s2-by" style={delay}>
          <g className="rifa-a rifa-s2-b" style={delay}>
            <ellipse rx="15" ry="13" fill={fill} stroke={stroke} strokeWidth="2.5" />
            <path d="M13 0 l7 -4 l0 8z" fill={fill} stroke={stroke} strokeWidth="2" />
            <ellipse cx="-5" cy="-5" rx="4" ry="3" fill={shine} />
          </g>
        </g>
      </g>
    </g>
  );
}

/** Carnival: two water balloons hit the duende; the second tears the sign in half. */
export function GlobazoScene({ name }: { name: string }) {
  const t = useTranslations('rifa.scenes');
  const id = useSvgIds();
  return (
    <Stage ids={id} label={t('labels.globazo', { name })}>
      <DuendeDefs />
      <defs>
        <clipPath id={id('tear-left')}>
          <polygon points="-95,-140 2,-140 -6,-120 6,-104 -6,-88 6,-72 -4,-58 2,-44 -95,-44" />
        </clipPath>
        <clipPath id={id('tear-right')}>
          <polygon points="2,-140 95,-140 95,-44 2,-44 -4,-58 6,-72 -6,-88 6,-104 -6,-120" />
        </clipPath>
      </defs>
      <rect width="400" height="300" fill="#1a0e2e" />
      <Stars points={STARS} />
      {/* carnival: bunting, streamers and the sign */}
      <path d="M0 26 Q200 70 400 22" fill="none" stroke="#cfc3e6" strokeWidth="2" />
      <g stroke="#1a0e2e" strokeWidth="1.5">
        {FLAGS.map(([x, y, fill, delay]) => (
          <polygon key={x} className="rifa-flag" points={`${x},${y} ${x + 18},${y} ${x + 9},${y + 20}`} fill={fill} style={{ animationDelay: delay }} />
        ))}
      </g>
      <g fill="none" strokeWidth="3" strokeLinecap="round">
        {STREAMERS.map(([d, stroke, delay]) => (
          <path key={d} className="rifa-flag" d={d} stroke={stroke} style={{ animationDelay: delay }} />
        ))}
      </g>
      <rect x="66" y="150" width="8" height="122" rx="2" fill="#6b4423" stroke="#1a0e2e" strokeWidth="1.5" />
      <g transform="translate(70 142) rotate(-5)">
        <rect x="-64" y="-23" width="128" height="42" rx="7" fill={SOL} stroke="#78350F" strokeWidth="3" />
        <rect x="-58" y="-17" width="116" height="30" rx="5" fill="none" stroke={TAJIBO} strokeWidth="2" strokeDasharray="6 4" />
        <text y="5" textAnchor="middle" fontSize="19" fill="#1a0e2e">
          {t('carnavalito')}
        </text>
        <path d="M-64 -14 c10 -14 22 6 30 -8 c8 -12 20 4 26 -6" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" />
      </g>
      <rect x="0" y="270" width="400" height="30" fill={GREEN} />
      <rect x="0" y="270" width="400" height="5" fill="#16a34a" opacity=".6" />
      <g opacity=".9">
        <rect x="22" y="282" width="6" height="4" fill={SOL} transform="rotate(20 25 284)" />
        <rect x="110" y="288" width="6" height="4" fill={TAJIBO} transform="rotate(-30 113 290)" />
        <rect x="150" y="278" width="5" height="4" fill={WHITE} />
        <rect x="300" y="285" width="6" height="4" fill={LILA} transform="rotate(40 303 287)" />
        <rect x="350" y="279" width="6" height="4" fill={SOL} transform="rotate(-15 353 281)" />
        <rect x="380" y="290" width="5" height="4" fill={TAJIBO} />
      </g>
      <Duende
        name={name}
        x={235}
        y={272}
        scale={0.48}
        className="rifa-a rifa-s2-squash"
        loop="rifa-bob 1.8s ease-in-out infinite"
        sign={<TornSign name={name} id={id} />}
        hat={
          <g transform="translate(0 -225)">
            <g className="rifa-a rifa-s2-hat">
              <g transform="translate(0 225)">
                <DuendeHat />
              </g>
            </g>
          </g>
        }
      >
        <g className="rifa-a rifa-s2-drips" fill="#7dd3fc">
          {DRIPS.map(([cx, cy, r, animation]) => (
            <circle key={cx} className="rifa-loop" cx={cx} cy={cy} r={r} style={loop(animation)} />
          ))}
        </g>
      </Duende>
      <Balloon fill="#38bdf8" stroke="#0c4a6e" shine="#e0f2fe" />
      <Balloon fill={TAJIBO} stroke="#831843" shine="#fbcfe8" second />
      <g transform="translate(235 228)" fill="#7dd3fc">
        {SPLASHES.map(([dx, dy, r, f]) => (
          <circle key={`${dx}-${f}`} className="rifa-a rifa-splash" r={r} style={{ ...vars({ '--dx': `${dx}px`, '--dy': `${dy}px` }), ...at(f) }} />
        ))}
      </g>
      <AlAgua />
    </Stage>
  );
}
