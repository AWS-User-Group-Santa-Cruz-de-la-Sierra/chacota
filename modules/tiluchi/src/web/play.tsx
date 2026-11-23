'use client';

import { useCountdown } from '@chacota/live/react';
import type { PlayScreenProps } from '@chacota/live/web';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PublicQuestion, RankEntry, TiluchiEvent, TiluchiSnapshot } from '../server/model';
import { choiceLabel } from './answer-grid';
import { AnswerIcon, ANSWER_STYLES } from './answer-icons';

type Screen =
  | { kind: 'waiting' }
  | { kind: 'question'; index: number; question: PublicQuestion; startedAt: number; answered?: string; timeUp?: boolean }
  | { kind: 'reveal'; index: number; correct: string[]; mine?: RankEntry; myAnswer?: string; poll: boolean }
  | { kind: 'leaderboard'; rank?: number };

function fromSnapshot(s: TiluchiSnapshot): Screen {
  if (s.phase === 'question' && s.question && s.startedAt) {
    return { kind: 'question', index: s.index, question: s.question, startedAt: s.startedAt, answered: s.answered?.value };
  }
  return s.phase === 'reveal' || s.phase === 'leaderboard' ? { kind: 'leaderboard' } : { kind: 'waiting' };
}

/** Phone screen while a Tiluchi runs: answer buttons, correct or not, and current rank. */
export function TiluchiPlay({ token, apiUrl, snapshot, clock, playerId, subscribe, setScore }: PlayScreenProps) {
  const t = useTranslations('tiluchi.play');
  const labels = { true: t('trueLabel'), false: t('falseLabel') };
  const [screen, setScreen] = useState<Screen>(() => fromSnapshot(snapshot as unknown as TiluchiSnapshot));
  // Read inside the event listener, so refs rather than state.
  const rank = useRef<number | undefined>(undefined);
  const myAnswers = useRef<Record<number, string>>({});

  useEffect(
    () =>
      subscribe((event) => {
        const e = event as TiluchiEvent;
        switch (e.type) {
          case 'tiluchi.question':
            setScreen({ kind: 'question', index: e.index, question: e.question, startedAt: e.startedAt });
            break;
          case 'tiluchi.reveal': {
            const mine = e.ranks[playerId];
            if (mine) {
              setScore(mine.score);
              rank.current = mine.rank;
            }
            setScreen({
              kind: 'reveal',
              index: e.index,
              correct: e.correct,
              mine,
              myAnswer: myAnswers.current[e.index],
              poll: e.correct.length === 0,
            });
            break;
          }
          case 'tiluchi.leaderboard':
            setScreen({ kind: 'leaderboard', rank: rank.current });
            break;
        }
      }),
    [subscribe, playerId, setScore],
  );

  async function answer(index: number, value: string) {
    if (screen.kind !== 'question' || screen.answered) return;
    setScreen({ ...screen, answered: value });
    myAnswers.current = { ...myAnswers.current, [index]: value };
    const res = await fetch(`${apiUrl}/m/tiluchi/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ questionIndex: index, value }),
    }).catch(() => null);
    if (res && !res.ok) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      if (error === 'not_accepting_answers') setScreen((s) => (s.kind === 'question' ? { ...s, timeUp: true } : s));
    }
  }

  switch (screen.kind) {
    case 'waiting':
      return (
        <Centered>
          <p className="font-display text-4xl font-extrabold text-sol">{t('getReady')}</p>
        </Centered>
      );
    case 'question':
      return <QuestionScreen screen={screen} now={clock.now} labels={labels} onAnswer={(v) => answer(screen.index, v)} />;
    case 'reveal':
      return <RevealScreen screen={screen} />;
    case 'leaderboard':
      return (
        <Centered>
          {screen.rank && <p className="font-display text-4xl font-extrabold">{t('rank', { rank: screen.rank })}</p>}
          <p className="text-lg text-niebla">{t('lookAtScreen')}</p>
        </Centered>
      );
  }
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">{children}</div>;
}

function QuestionScreen({
  screen,
  now,
  labels,
  onAnswer,
}: {
  screen: Extract<Screen, { kind: 'question' }>;
  now: () => number;
  labels: { true: string; false: string };
  onAnswer: (value: string) => void;
}) {
  const t = useTranslations('tiluchi.play');
  const deadline = screen.startedAt + screen.question.timeLimitSec * 1000;
  const leadOrNull = useCountdown(screen.startedAt, now);
  const leftOrNull = useCountdown(deadline, now);

  if (leadOrNull === null || leftOrNull === null) return <Centered>{null}</Centered>;
  const lead = leadOrNull;
  const left = leftOrNull;
  if (screen.answered) {
    return (
      <Centered>
        <p className="font-display text-4xl font-extrabold">{t('sent')}</p>
        <p className="text-lg text-niebla">{t('waitOthers')}</p>
      </Centered>
    );
  }
  if (screen.timeUp || (lead === 0 && left === 0)) {
    return (
      <Centered>
        <p className="font-display text-4xl font-extrabold">{t('timeUp')}</p>
      </Centered>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-2xl font-extrabold leading-tight">{screen.question.prompt}</p>
        <span className="shrink-0 rounded-full bg-noche-2 px-3 py-1 font-display text-xl font-bold tabular-nums">
          {Math.ceil((lead > 0 ? lead : left) / 1000)}
        </span>
      </div>
      {lead > 0 ? (
        <Centered>
          <p className="font-display text-4xl font-extrabold text-sol">{t('getReady')}</p>
        </Centered>
      ) : (
        <div className={`grid flex-1 gap-3 ${screen.question.choices.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {screen.question.choices.map((c, i) => {
            const style = ANSWER_STYLES[i % ANSWER_STYLES.length]!;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onAnswer(c.id)}
                className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-3xl p-3 text-lg font-bold active:scale-[0.98] ${style.bg} ${style.fg}`}
              >
                <AnswerIcon index={i} size={48} />
                {choiceLabel(c, screen.question.type, labels)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RevealScreen({ screen }: { screen: Extract<Screen, { kind: 'reveal' }> }) {
  const t = useTranslations('tiluchi.play');
  const answered = screen.mine?.answered ?? screen.myAnswer !== undefined;
  const correct = screen.mine?.correct ?? (screen.myAnswer !== undefined && screen.correct.includes(screen.myAnswer));
  const tone = screen.poll ? 'bg-morado' : !answered ? 'bg-noche-2' : correct ? 'bg-verde' : 'bg-tajibo';
  return (
    <div className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl text-center ${tone}`}>
      <p className="font-display text-5xl font-extrabold">
        {screen.poll ? t('pollThanks') : !answered ? t('noAnswer') : correct ? t('correct') : t('incorrect')}
      </p>
      {!screen.poll && screen.mine && screen.mine.points > 0 && <p className="text-2xl font-bold">{t('points', { points: screen.mine.points })}</p>}
      {screen.mine && <p className="text-lg">{t('rank', { rank: screen.mine.rank })}</p>}
    </div>
  );
}
