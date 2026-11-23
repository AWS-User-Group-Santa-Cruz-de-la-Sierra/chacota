'use client';

import type { Standing } from '@chacota/live/client';
import { animate, AnimatePresence, motion, MotionConfig, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';

/** How long the previous order stays on screen before the rows move. */
const HOLD_MS = 1200;
/** How long the rows take to reach their places, leaving rows to drop out and scores to finish counting. */
const SETTLE_MS = 1500;

/** A score that counts up (or down) to its new value. */
function Score({ value }: { value: number }) {
  const shown = useMotionValue(value);
  const text = useTransform(shown, (v) => String(Math.round(v)));
  useEffect(() => {
    const controls = animate(shown, value, { duration: 1.2, ease: 'easeOut' });
    return () => controls.stop();
  }, [shown, value]);
  return <motion.span className="font-display tabular-nums">{text}</motion.span>;
}

/**
 * The ranking after a question. It opens with the top as it was before the question, then the
 * scores count up and the rows slide to their new places: whoever overtakes moves up, players who
 * enter the top come in from below and those who leave drop out.
 */
export function Leaderboard({ title, top, before }: { title: string; top: Standing[]; before: Standing[] }) {
  // Without a previous order (e.g. after a reload) the current one shows right away.
  const [rows, setRows] = useState(before.length > 0 ? before : top);
  const moved = rows === top;
  // Final order on screen and nothing still moving. Marked on the list for tests (data-settled).
  const [settled, setSettled] = useState(before.length === 0);
  useEffect(() => {
    if (settled) return;
    const timer = moved ? setTimeout(() => setSettled(true), SETTLE_MS) : setTimeout(() => setRows(top), HOLD_MS);
    return () => clearTimeout(timer);
  }, [moved, settled, top]);

  const rankBefore = new Map(before.map((s, i) => [s.nickname, i]));

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-center font-display text-5xl font-extrabold">{title}</h1>
        <ol className="relative flex flex-col gap-3" data-settled={settled || undefined}>
          <AnimatePresence initial mode="popLayout">
            {rows.map((s, i) => {
              const was = rankBefore.get(s.nickname);
              const climbed = moved && before.length > 0 && (was === undefined || was > i);
              return (
                <motion.li
                  key={s.nickname}
                  layout
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 60 }}
                  transition={{
                    layout: { type: 'spring', stiffness: 260, damping: 30 },
                    default: { duration: 0.4, delay: moved ? 0 : i * 0.08 },
                  }}
                  className={`flex items-center gap-4 rounded-2xl px-6 py-4 text-2xl font-bold transition-colors duration-700 ${climbed ? 'bg-morado' : 'bg-noche-2'}`}
                >
                  <span className="w-10 font-display text-niebla">{i + 1}</span>
                  <span className="flex-1">{s.nickname}</span>
                  {climbed && (
                    <motion.span
                      aria-hidden
                      className="text-sol"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      ▲
                    </motion.span>
                  )}
                  <Score value={s.score} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </div>
    </MotionConfig>
  );
}
