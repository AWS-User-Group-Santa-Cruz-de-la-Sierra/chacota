'use client';

import { useTranslations } from 'next-intl';
import { Duende, DuendeDefs, DuendeHat, NameTag } from './duende';
import { AlAgua, Stage, Stars, useSvgIds } from './stage';

const STARS: [number, number, number, string, string][] = [
  [40, 30, 1.6, '', ''],
  [120, 50, 1.2, '', ''],
  [370, 70, 1.8, '', ''],
  [250, 26, 1.4, '', ''],
];

/**
 * Low-motion stand-in for every "al agua" scene: two still frames cut at half time. First the
 * duende on the pier with its dry sign; then the sign floating, soaked, next to the hat.
 */
export function ReducedOutScene({ name }: { name: string }) {
  const t = useTranslations('rifa.scenes');
  const id = useSvgIds();
  return (
    <Stage ids={id} label={t('labels.reduced', { name })}>
      <DuendeDefs />
      <rect width="400" height="300" fill="#1a0e2e" />
      <circle cx="330" cy="52" r="22" fill="#fde68a" opacity=".85" />
      <Stars points={STARS} twinkle={false} />
      <rect x="0" y="242" width="400" height="58" fill="#0c4a6e" />
      {/* pier */}
      <g fill="#6b4423" stroke="#1a0e2e" strokeWidth="1.5">
        <rect x="32" y="248" width="8" height="40" />
        <rect x="150" y="248" width="8" height="40" />
        <rect x="20" y="238" width="150" height="10" rx="2" />
      </g>
      <g className="rifa-a rifa-r-before">
        <Duende name={name} x={95} y={240} scale={0.42} />
      </g>
      <g className="rifa-a rifa-r-after">
        <g transform="translate(210 258) scale(.26)">
          <DuendeHat y={-190} />
        </g>
        <g transform="translate(308 250) rotate(-6) scale(.72)">
          <NameTag name={name} wet={{ opacity: 0.35 }} />
        </g>
      </g>
      <rect x="0" y="266" width="400" height="34" fill="#0369a1" opacity=".93" />
      <path d="M0 266 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#7dd3fc" strokeWidth="2.5" opacity=".8" />
      <g className="rifa-a rifa-r-after">
        <AlAgua still />
      </g>
    </Stage>
  );
}
