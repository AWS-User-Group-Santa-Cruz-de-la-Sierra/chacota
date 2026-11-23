'use client';

import type { Standing } from '@chacota/live/client';
import confetti from 'canvas-confetti';
import { motion, MotionConfig } from 'motion/react';
import { useEffect } from 'react';

const HEIGHTS = ['h-64', 'h-48', 'h-36'];
const COLORS = ['bg-sol text-noche', 'bg-morado', 'bg-tajibo'];
const CONFETTI_COLORS = ['#ffc629', '#6b2fd6', '#d63a72', '#8a5cf0', '#fbf8ff'];

/** Seconds: when the first step rises, how long a name takes after its step, and the gaps between places. */
const START = 0.8;
const NAME_AFTER = 0.6;
const GAP = 1.8;
const GAP_BEFORE_FIRST = 2.6;
const MENTIONS_AFTER_FIRST = 2.2;
const MENTION_GAP = 0.5;

interface Timeline {
  /** Per place (0 = first): when its step rises and when its name shows. */
  step: number[];
  name: number[];
  /** When each mention (4th, 5th) shows. */
  mentions: number[];
}

/** The reveal order is third, second, first, then the mentions; missing places take no time. */
function timeline(places: number, mentions: number): Timeline {
  const step: number[] = [];
  const name: number[] = [];
  let t = START;
  for (const pos of [2, 1, 0]) {
    if (pos >= places) continue;
    step[pos] = t;
    name[pos] = t + NAME_AFTER;
    t += pos === 1 ? GAP_BEFORE_FIRST : GAP;
  }
  const mentionsAt = (name[0] ?? t) + MENTIONS_AFTER_FIRST;
  return { step, name, mentions: Array.from({ length: mentions }, (_, i) => mentionsAt + i * MENTION_GAP) };
}

function celebrate() {
  const options = { colors: CONFETTI_COLORS, disableForReducedMotion: true };
  confetti({ ...options, particleCount: 90, spread: 70, angle: 60, startVelocity: 55, origin: { x: 0.2, y: 0.75 } });
  confetti({ ...options, particleCount: 90, spread: 70, angle: 120, startVelocity: 55, origin: { x: 0.8, y: 0.75 } });
  setTimeout(() => confetti({ ...options, particleCount: 140, spread: 110, origin: { y: 0.4 } }), 350);
}

/**
 * The final podium, revealed by itself: the third place's step rises and its name shows, then the
 * second's, then, after a pause, the first's with confetti. The 4th and 5th places come last, below,
 * as honorable mentions.
 */
export function Podium({ title, mentionsLabel, podium }: { title: string; mentionsLabel: string; podium: Standing[] }) {
  const places = Math.min(podium.length, 3);
  const mentions = podium.slice(3, 5);
  const times = timeline(places, mentions.length);
  const firstNameAt = times.name[0];

  useEffect(() => {
    if (firstNameAt === undefined) return;
    const timer = setTimeout(celebrate, firstNameAt * 1000);
    return () => {
      clearTimeout(timer);
      confetti.reset();
    };
  }, [firstNameAt]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col items-center gap-8">
        <motion.h1
          className="font-display text-6xl font-extrabold"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {title}
        </motion.h1>
        <ol className="flex items-end justify-center gap-4">
          {[1, 0, 2].map((pos) => {
            const s = podium[pos];
            if (!s) return null;
            const first = pos === 0;
            return (
              <li key={pos} className="flex w-40 flex-col items-center gap-2 lg:w-56">
                <motion.div
                  className="flex flex-col items-center gap-2"
                  initial={{ opacity: 0, y: -30, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: first ? [0.6, 1.25, 1] : 1 }}
                  transition={
                    first
                      ? { duration: 0.6, delay: times.name[pos] }
                      : { type: 'spring', stiffness: 300, damping: 18, delay: times.name[pos] }
                  }
                >
                  <span className="text-center text-2xl font-bold">{s.nickname}</span>
                  <span className="font-display text-xl tabular-nums text-niebla">{s.score}</span>
                </motion.div>
                <motion.span
                  className={`flex w-full origin-bottom items-start justify-center rounded-t-2xl pt-4 font-display text-5xl font-extrabold ${HEIGHTS[pos]} ${COLORS[pos]}`}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 140, damping: 16, delay: times.step[pos] }}
                >
                  {pos + 1}
                </motion.span>
              </li>
            );
          })}
        </ol>
        {mentions.length > 0 && (
          <div className="flex flex-col items-center gap-3">
            <motion.span
              className="text-sm font-bold uppercase tracking-widest text-niebla"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: times.mentions[0] }}
            >
              {mentionsLabel}
            </motion.span>
            <ol className="flex flex-wrap justify-center gap-4">
              {mentions.map((s, i) => (
                <motion.li
                  key={i}
                  className="flex min-w-56 items-center gap-4 rounded-2xl bg-noche-2 px-5 py-3 text-xl font-bold"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: times.mentions[i] }}
                >
                  <span className="font-display text-niebla">{4 + i}</span>
                  <span className="flex-1">{s.nickname}</span>
                  <span className="font-display tabular-nums text-niebla">{s.score}</span>
                </motion.li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
