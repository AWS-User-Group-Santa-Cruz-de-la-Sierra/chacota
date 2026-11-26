'use client';

import type { Standing } from '@chacota/live/client';
import { useCountdown } from '@chacota/live/react';
import type { HostScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { QUESTION_LEAD_MS, type TiluchiEvent, type TiluchiSnapshot } from '../server/model';
import { AnswerTiles } from './answer-grid';
import { Leaderboard } from './leaderboard';

type Screen =
  | { kind: 'waiting' }
  | { kind: 'question'; index: number; startedAt: number }
  | { kind: 'reveal'; index: number; correct: string[]; counts: Record<string, number>; answered: number }
  | { kind: 'leaderboard'; index: number; top: Standing[]; before: Standing[] };

function fromSnapshot(s: TiluchiSnapshot): Screen {
  switch (s.phase) {
    case 'question':
      return s.startedAt ? { kind: 'question', index: s.index, startedAt: s.startedAt } : { kind: 'waiting' };
    case 'reveal':
      return { kind: 'reveal', index: s.index, correct: [], counts: {}, answered: 0, ...s.reveal };
    case 'leaderboard':
      // No previous order after a reload: the current one shows without moving.
      return { kind: 'leaderboard', index: s.index, top: s.top ?? [], before: [] };
    default:
      return { kind: 'waiting' };
  }
}

/** Presenter screen while a Tiluchi runs: question with timer, reveal and ranking. */
/** The question's image, hidden if it can't be loaded. */
function QuestionImage({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return <img src={src} alt="" className="max-h-[45vh] w-full rounded-3xl object-contain" onError={() => setBroken(true)} />;
}

export function TiluchiHost({
  snapshot,
  clock,
  playerCount,
  subscribe,
  advance,
  setAdvanceLabel,
  setSubtitle,
  hostAction,
  setBackground,
  mediaUrl,
}: HostScreenProps) {
  const t = useTranslations('tiluchi.host');
  const tp = useTranslations('tiluchi.play');
  const labels = { true: tp('trueLabel'), false: tp('falseLabel') };
  const initial = snapshot as unknown as TiluchiSnapshot;
  const questions = initial.questions ?? [];
  const total = initial.total;
  const [screen, setScreen] = useState<Screen>(() => fromSnapshot(initial));
  // Tagged with its question: a count still in flight from the previous question must not count for this one.
  const [answers, setAnswers] = useState({ index: -1, count: 0 });
  const autoRevealed = useRef(-1);

  useEffect(
    () =>
      subscribe((event) => {
        const e = event as TiluchiEvent;
        switch (e.type) {
          case 'tiluchi.question':
            setScreen({ kind: 'question', index: e.index, startedAt: e.startedAt });
            break;
          case 'tiluchi.reveal':
            setScreen({ kind: 'reveal', index: e.index, correct: e.correct, counts: e.counts, answered: e.answered });
            break;
          case 'tiluchi.leaderboard':
            setScreen({ kind: 'leaderboard', index: e.index, top: e.top, before: e.before });
            break;
        }
      }),
    [subscribe],
  );

  const isLast = screen.kind !== 'waiting' && screen.index + 1 >= total;
  const label =
    screen.kind === 'question'
      ? t('showAnswer')
      : isLast && (screen.kind === 'reveal' || screen.kind === 'leaderboard')
        ? t('showPodium')
        : screen.kind === 'reveal'
          ? t('showRanking')
          : t('nextQuestion');
  useEffect(() => setAdvanceLabel(label), [label, setAdvanceLabel]);
  const subtitle = screen.kind === 'question' || screen.kind === 'reveal' ? t('questionOf', { n: screen.index + 1, total }) : null;
  useEffect(() => setSubtitle(subtitle), [subtitle, setSubtitle]);

  // Background of the current question (or the quiz's); "get ready" already shows the first one's.
  const bgKey = questions[screen.kind === 'waiting' ? 0 : screen.index]?.backgroundKey ?? null;
  useEffect(() => setBackground(bgKey), [bgKey, setBackground]);

  // While a question is open: poll the answer count, reveal when time is up or everyone answered.
  const question = screen.kind === 'question' ? questions[screen.index] : undefined;
  const deadline = screen.kind === 'question' && question ? screen.startedAt + question.timeLimitSec * 1000 : undefined;
  const msLeftOrNull = useCountdown(deadline, clock.now);
  const leadLeftOrNull = useCountdown(screen.kind === 'question' ? screen.startedAt : undefined, clock.now);
  // Until mounted the clock is unknown: show the reading phase without numbers.
  const ready = msLeftOrNull !== null && leadLeftOrNull !== null;
  const msLeft = msLeftOrNull ?? 0;
  const leadLeft = leadLeftOrNull ?? QUESTION_LEAD_MS;
  const answerCount = screen.kind === 'question' && answers.index === screen.index ? answers.count : 0;

  useEffect(() => {
    if (screen.kind !== 'question') return;
    const index = screen.index;
    const timer = setInterval(async () => setAnswers({ index, count: (await hostAction('countAnswers', { index })) as number }), 1000);
    return () => clearInterval(timer);
  }, [screen, hostAction]);

  useEffect(() => {
    if (screen.kind !== 'question' || autoRevealed.current === screen.index) return;
    const everyone = playerCount > 0 && answerCount >= playerCount;
    // The clock check repeats the countdown's: revealing a question that is still open loses everyone's answers.
    const timeUp = ready && deadline !== undefined && msLeft === 0 && clock.now() >= deadline;
    if (timeUp || everyone) {
      autoRevealed.current = screen.index;
      advance();
    }
  }, [screen, msLeft, ready, answerCount, playerCount, deadline, advance, clock]);

  return (
    <>
      {screen.kind === 'waiting' && <p className="text-center font-display text-4xl font-bold text-sol">{t('getReady')}</p>}

      {screen.kind === 'question' && question && (
        <>
          {(() => {
            const timer = (
              <div
                className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full font-display text-6xl font-extrabold"
                style={{
                  background: `conic-gradient(#FFC629 0 ${!ready || leadLeft > 0 ? 100 : Math.round((msLeft / (question.timeLimitSec * 1000)) * 1000) / 10}%, #2B1A47 0)`,
                }}
              >
                <span className="flex h-26 w-26 items-center justify-center rounded-full bg-noche tabular-nums">
                  {!ready ? '' : leadLeft > 0 ? Math.ceil(leadLeft / 1000) : Math.ceil(msLeft / 1000)}
                </span>
              </div>
            );
            const count = (
              <div className="flex shrink-0 flex-col items-center">
                <span className="font-display text-6xl font-extrabold tabular-nums">{answerCount}</span>
                <span className="text-niebla">{t('answers', { count: answerCount })}</span>
              </div>
            );
            return question.imageKey ? (
              <div className="grid items-center gap-8 lg:grid-cols-[2fr_3fr]">
                <QuestionImage key={question.imageKey} src={mediaUrl(question.imageKey)} />
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-6">
                    {timer}
                    {count}
                  </div>
                  <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">{question.prompt}</h1>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-8">
                {timer}
                <h1 className="flex-1 font-display text-4xl font-extrabold leading-tight tracking-tight lg:text-6xl">{question.prompt}</h1>
                {count}
              </div>
            );
          })()}
          {leadLeft > QUESTION_LEAD_MS / 3 ? (
            <p className="text-center font-display text-4xl font-bold text-sol">{t('getReady')}</p>
          ) : (
            <AnswerTiles question={question} labels={labels} />
          )}
        </>
      )}

      {screen.kind === 'reveal' && questions[screen.index] && (
        <>
          {questions[screen.index]!.imageKey ? (
            <div className="grid items-center gap-8 lg:grid-cols-[2fr_3fr]">
              <QuestionImage key={questions[screen.index]!.imageKey} src={mediaUrl(questions[screen.index]!.imageKey!)} />
              <h1 className="font-display text-4xl font-extrabold leading-tight lg:text-5xl">{questions[screen.index]!.prompt}</h1>
            </div>
          ) : (
            <h1 className="font-display text-4xl font-extrabold leading-tight lg:text-5xl">{questions[screen.index]!.prompt}</h1>
          )}
          <AnswerTiles question={questions[screen.index]!} labels={labels} highlight={screen.correct} counts={screen.counts} />
          <p className="text-center text-xl text-niebla">{t('answers', { count: screen.answered })}</p>
        </>
      )}

      {screen.kind === 'leaderboard' && (
        <Leaderboard key={screen.index} title={t('ranking')} top={screen.top} before={screen.before} />
      )}
    </>
  );
}
