'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useStageIds } from './stage';
import { fitTagFont, tagNeedsSqueeze, TAG_WIDTH } from './tag';

const INK = '#1E293B';

/** Brim fringe of the sombrero de saó. */
const FRINGE: [number, number, number, number][] = [
  [48, 198, 36, 220], [62, 206, 52, 230], [80, 214, 72, 238], [100, 220, 94, 245], [122, 224, 118, 250],
  [145, 228, 142, 254], [168, 230, 167, 256], [192, 231, 192, 257], [215, 231, 216, 257], [238, 229, 241, 255],
  [262, 226, 266, 252], [285, 222, 291, 247], [306, 216, 314, 240], [326, 208, 336, 232], [344, 198, 356, 220],
];

/** Gradients and the duende's two symbols (body and hat apart, so the hat can fly off). Goes inside a stage. */
export function DuendeDefs() {
  const id = useStageIds();
  const sao = `url(#${id('sao')})`;
  return (
    <defs>
      <linearGradient id={id('sao')} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#F3E5AB" />
        <stop offset=".5" stopColor="#DFC47C" />
        <stop offset="1" stopColor="#C5A358" />
      </linearGradient>
      <linearGradient id={id('robe')} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#E2E8F0" />
        <stop offset=".35" stopColor="#fff" />
        <stop offset=".75" stopColor="#F8FAFC" />
        <stop offset="1" stopColor="#CBD5E1" />
      </linearGradient>
      <symbol id={id('body')} viewBox="0 0 400 440">
        <ellipse cx="200" cy="402" rx="85" ry="14" fill="#000" opacity=".35" />
        <ellipse cx="168" cy="390" rx="22" ry="11" fill="#F8FAFC" stroke={INK} strokeWidth="3.5" />
        <ellipse cx="232" cy="390" rx="22" ry="11" fill="#F8FAFC" stroke={INK} strokeWidth="3.5" />
        <path
          d="M135 215C120 265 115 330 128 382Q165 394 200 386Q235 394 272 382C285 330 280 265 265 215Z"
          fill={`url(#${id('robe')})`}
          stroke={INK}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M155 245Q148 315 154 378M245 245Q252 315 246 378" fill="none" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
        <path d="M132 238C102 252 98 282 122 290C132 293 140 282 136 270" fill="#fff" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M268 238C298 252 302 282 278 290C268 293 260 282 264 270" fill="#fff" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </symbol>
      <symbol id={id('hat')} viewBox="0 0 400 440">
        <ellipse cx="200" cy="208" rx="138" ry="34" fill="#0F172A" />
        <g stroke="#C5A358" strokeWidth="3.5" strokeLinecap="round">
          {FRINGE.map(([x1, y1, x2, y2]) => (
            <line key={x1} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
        <path d="M42 192C42 135 115 110 200 110C285 110 358 135 358 192C358 222 285 236 200 236C115 236 42 222 42 192Z" fill={sao} stroke={INK} strokeWidth="4" />
        <ellipse cx="200" cy="182" rx="136" ry="38" fill="none" stroke="#B69146" strokeWidth="2" strokeDasharray="6,4" />
        <ellipse cx="200" cy="176" rx="108" ry="29" fill="none" stroke="#B69146" strokeWidth="2" strokeDasharray="6,4" />
        <path d="M195 150Q225 182 262 225" fill="none" stroke="#1E6B45" strokeWidth="14" strokeDasharray="8,5" opacity=".85" />
        <path d="M162 152Q130 185 95 216" fill="none" stroke="#1E6B45" strokeWidth="11" strokeDasharray="7,5" opacity=".75" />
        <path d="M248 145Q290 165 328 198" fill="none" stroke="#1E6B45" strokeWidth="10" strokeDasharray="7,5" opacity=".7" />
        <path d="M142 142C142 82 158 58 200 58C242 58 258 82 258 142C258 156 142 156 142 142Z" fill={sao} stroke={INK} strokeWidth="4" />
        <path d="M162 145L222 68" stroke="#1E6B45" strokeWidth="11" strokeDasharray="6,4" opacity=".85" />
        <path d="M188 148L242 82" stroke="#1E6B45" strokeWidth="8" strokeDasharray="6,4" opacity=".75" />
        <path d="M143 142Q200 156 257 142" fill="none" stroke="#8C6D2E" strokeWidth="3" />
      </symbol>
    </defs>
  );
}

/** The robe, feet and hands; its origin is between the feet. */
export function DuendeBody() {
  const id = useStageIds();
  return <use href={`#${id('body')}`} x={-200} y={-400} width={400} height={440} />;
}

/** The sombrero de saó, placed as worn; `y` moves it (e.g. -190 to float it on its own). */
export function DuendeHat({ y = -400 }: { y?: number }) {
  const id = useStageIds();
  return <use href={`#${id('hat')}`} x={-200} y={y} width={400} height={440} />;
}

/** The two strings the sign hangs from. */
export function SignStrings() {
  return (
    <g stroke="#78350F" strokeWidth="3.5">
      <line x1={-25} y1={-185} x2={-48} y2={-125} />
      <line x1={25} y1={-185} x2={48} y2={-125} />
    </g>
  );
}

const CHEST = { width: 156, height: 72, stroke: 4, rx: 8 };
const LOOSE = { width: 92, height: 34, stroke: 3, rx: 6 };

/**
 * The cardboard sign with a name, centred on 0,0. The chest size is the reference for `fitTagFont`;
 * the loose one (when the sign travels alone) scales the type to its own width.
 */
export function NameTag({ name, loose = false, wet }: { name: string; loose?: boolean; wet?: { className?: string; opacity?: number } }) {
  const { width, height, stroke, rx } = loose ? LOOSE : CHEST;
  const k = (width - 16) / TAG_WIDTH;
  const font = fitTagFont(name) * k;
  const squeeze = tagNeedsSqueeze(name);
  const box = { x: -width / 2, y: -height / 2, width, height, rx };
  return (
    <g>
      <rect {...box} fill="#E9C98F" stroke="#78350F" strokeWidth={stroke} />
      <text
        y={font * 0.35}
        textAnchor="middle"
        fontSize={font}
        fill="#78350F"
        textLength={squeeze ? TAG_WIDTH * k : undefined}
        lengthAdjust={squeeze ? 'spacingAndGlyphs' : undefined}
      >
        {name}
      </text>
      {wet ? <rect {...box} className={wet.className} opacity={wet.opacity} fill="#1e3a8a" /> : null}
    </g>
  );
}

/** Strings plus the sign on the chest. */
export function ChestSign({ name }: { name: string }) {
  return (
    <>
      <SignStrings />
      <g transform="translate(0 -92)">
        <NameTag name={name} />
      </g>
    </>
  );
}

interface DuendeProps {
  name: string;
  x: number;
  y: number;
  scale: number;
  /** One-shot animation of the whole figure. */
  className?: string;
  /** Idle loop inside it, e.g. `rifa-bob 1.8s ease-in-out infinite`. */
  loop?: string;
  /** Replaces the chest sign (a torn one, a bag of sweets). */
  sign?: ReactNode;
  /** Replaces the worn hat (one that jumps off). */
  hat?: ReactNode;
  /** Drawn in front of the figure, in its coordinates. */
  children?: ReactNode;
}

/** The duende: white robe, sombrero de saó over the face, and the name sign on the chest. */
export function Duende({ name, x, y, scale, className, loop, sign, hat, children }: DuendeProps) {
  const idle: CSSProperties | undefined = loop ? { animation: loop } : undefined;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={className}>
        <g className={loop ? 'rifa-loop' : undefined} style={idle}>
          <DuendeBody />
          {sign ?? <ChestSign name={name} />}
          {hat ?? <DuendeHat />}
          {children}
        </g>
      </g>
    </g>
  );
}
