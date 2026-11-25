'use client';

import { useTranslations } from 'next-intl';
import { Duende, DuendeDefs } from './duende';
import { loop, Stage, useSvgIds } from './stage';
import { fitTagFont, tagNeedsSqueeze, TAG_MAX_FONT, TAG_WIDTH } from './tag';

const SOL = '#ffc629';
const TAJIBO = '#d63a72';
const LILA = '#8a5cf0';
const GREEN = '#0b8048';

/** The neon name is the chest sign's type at 70/36 scale, centred on this line. */
const NEON = 70 / TAG_MAX_FONT;
const NEON_MIDDLE = 141.5;

/** Confetti: [x, colour, period, delay]. */
const CONFETTI: [number, string, string, string][] = [
  [30, SOL, '2.6s', '0s'], [90, TAJIBO, '2.2s', '.5s'], [150, LILA, '2.8s', '.2s'], [210, SOL, '2.4s', '.9s'], [270, GREEN, '2.5s', '.3s'],
  [330, TAJIBO, '2.3s', '1.1s'], [370, '#fbf8ff', '2.7s', '.7s'], [120, LILA, '2.9s', '1.4s'], [300, SOL, '2.1s', '1.6s'], [60, GREEN, '2.6s', '1.9s'],
];

/** Sweets thrown from the bag: [dx, peak, colour, period, delay]. */
const CANDY: [number, number, string, string, string][] = [
  [120, -90, SOL, '1.5s', '0s'],
  [200, -120, LILA, '1.8s', '.4s'],
  [70, -70, GREEN, '1.3s', '.8s'],
  [260, -140, TAJIBO, '2s', '1.1s'],
];

const SPARKS: [number, number, string, string, string][] = [
  [180, 70, 'M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2Z', '1.4s', '0s'],
  [290, 78, 'M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2Z', '1.4s', '.5s'],
  [300, 130, 'M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2Z', '1.2s', '.9s'],
];

function CandyBag() {
  const t = useTranslations('rifa.scenes');
  return (
    <g transform="translate(70 -150) rotate(12)">
      <path d="M-34 -10 L34 -10 L44 70 L-44 70Z" fill={TAJIBO} stroke="#1e293b" strokeWidth="4" strokeLinejoin="round" />
      <path d="M-34 -10 Q0 -40 34 -10" fill="none" stroke="#1e293b" strokeWidth="4" />
      <circle cx="-12" cy="-16" r="10" fill={SOL} stroke="#1e293b" strokeWidth="3" />
      <circle cx="12" cy="-20" r="9" fill={LILA} stroke="#1e293b" strokeWidth="3" />
      <circle cx="2" cy="-8" r="8" fill={GREEN} stroke="#1e293b" strokeWidth="3" />
      <text y="40" textAnchor="middle" fontSize="26" fill="#fbf8ff">
        {t('candy')}
      </text>
    </g>
  );
}

/**
 * The winner: lights out, a golden spotlight, the name lights up in neon, the crown drops and
 * bounces, and a duende hops throwing sweets. Inside `.rifa-still` it is the settled final frame.
 */
export function WinnerScene({ name }: { name: string }) {
  const t = useTranslations('rifa.scenes');
  const id = useSvgIds();
  const font = fitTagFont(name) * NEON;
  const squeeze = tagNeedsSqueeze(name);
  return (
    <Stage ids={id} label={t('labels.winner', { name })}>
      <DuendeDefs />
      <defs>
        <radialGradient id={id('spot')} cx=".5" cy=".45" r=".6">
          <stop offset="0" stopColor={SOL} stopOpacity=".45" />
          <stop offset=".6" stopColor={TAJIBO} stopOpacity=".12" />
          <stop offset="1" stopColor="#1a0e2e" stopOpacity="0" />
        </radialGradient>
        <filter id={id('neon')} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b2" />
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="400" height="300" fill="#140a26" />
      <rect className="rifa-a rifa-w-spot" width="400" height="300" fill={`url(#${id('spot')})`} />
      <g className="rifa-a rifa-w-after rifa-w-fly">
        {CONFETTI.map(([x, fill, period, delay]) => (
          <rect key={x} className="rifa-loop" width="6" height="10" fill={fill} style={loop(`rifa-confetti ${period} linear infinite ${delay}`, { '--x': `${x}px` })} />
        ))}
      </g>
      {/* the name in neon */}
      <g className="rifa-a rifa-w-neon" filter={`url(#${id('neon')})`}>
        <text
          x="232"
          y={NEON_MIDDLE + font * 0.35}
          textAnchor="middle"
          fontSize={font}
          fill="#fff7d6"
          stroke={SOL}
          strokeWidth="2"
          textLength={squeeze ? TAG_WIDTH * NEON : undefined}
          lengthAdjust={squeeze ? 'spacingAndGlyphs' : undefined}
        >
          {name}
        </text>
      </g>
      <text className="rifa-a rifa-w-after" x="232" y="200" textAnchor="middle" fontSize="16" fill={SOL} style={{ letterSpacing: '2px' }}>
        {t('winner')}
      </text>
      {/* the crown */}
      <g transform="translate(232 92)">
        <g className="rifa-a rifa-w-crown">
          <path d="M-38 16 L-46 -22 L-20 -2 L0 -32 L20 -2 L46 -22 L38 16Z" fill={SOL} stroke="#b45309" strokeWidth="3" strokeLinejoin="round" />
          <rect x="-39" y="10" width="78" height="10" rx="3" fill="#f59e0b" stroke="#b45309" strokeWidth="2.5" />
          <circle cx="0" cy="-32" r="5" fill={TAJIBO} />
          <circle cx="-46" cy="-22" r="4" fill={LILA} />
          <circle cx="46" cy="-22" r="4" fill={GREEN} />
          <circle cx="0" cy="4" r="5" fill={TAJIBO} />
        </g>
      </g>
      <g className="rifa-a rifa-w-after" fill="#fff7d6">
        {SPARKS.map(([x, y, d, period, delay]) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <path className="rifa-loop rifa-spark" d={d} style={loop(`rifa-spark ${period} ease-in-out infinite ${delay}`)} />
          </g>
        ))}
      </g>
      {/* the duende with the bag of sweets */}
      <Duende name={name} x={72} y={290} scale={0.38} loop="rifa-hop .8s infinite" sign={<CandyBag />} />
      {/* sweets flying */}
      <g className="rifa-a rifa-w-after rifa-w-fly" transform="translate(100 225)">
        {CANDY.map(([dx, peak, fill, period, delay]) => (
          <g key={dx} className="rifa-loop" style={loop(`rifa-candyx ${period} linear infinite ${delay}`, { '--cx': `${dx}px` })}>
            <g className="rifa-loop" style={loop(`rifa-candyy ${period} infinite ${delay}`, { '--cy1': `${peak}px`, '--cy2': '70px' })}>
              <g className="rifa-loop" style={loop(`rifa-candyspin ${period} linear infinite ${delay}`)}>
                <circle r="6" fill={fill} />
                <path d="M-6 0 l-6 -5 v10z M6 0 l6 -5 v10z" fill={fill} />
              </g>
            </g>
          </g>
        ))}
      </g>
    </Stage>
  );
}
