import type { PublicQuestion } from '@chacota/game/client';
import { AnswerIcon, ANSWER_STYLES } from '../answer-icons';

export function choiceLabel(choice: { id: string; text: string }, type: PublicQuestion['type'], labels: { true: string; false: string }) {
  if (type !== 'true_false') return choice.text;
  return choice.id === 'true' ? labels.true : labels.false;
}

/** Static answer tiles for the presenter screen. */
export function AnswerTiles({
  question,
  labels,
  highlight,
  counts,
}: {
  question: PublicQuestion;
  labels: { true: string; false: string };
  /** Correct choice ids after reveal; others are dimmed. */
  highlight?: string[];
  counts?: Record<string, number>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {question.choices.map((c, i) => {
        const style = ANSWER_STYLES[i % ANSWER_STYLES.length]!;
        const dim = highlight && highlight.length > 0 && !highlight.includes(c.id);
        return (
          <div
            key={c.id}
            className={`flex min-h-20 items-center gap-4 rounded-2xl px-6 text-2xl font-bold transition-opacity lg:min-h-24 lg:text-3xl ${style.bg} ${style.fg} ${dim ? 'opacity-35' : ''}`}
          >
            <AnswerIcon index={i} size={36} />
            <span className="flex-1">{choiceLabel(c, question.type, labels)}</span>
            {highlight?.includes(c.id) && <span aria-hidden="true">✓</span>}
            {counts && <span className="font-display tabular-nums">{counts[c.id] ?? 0}</span>}
          </div>
        );
      })}
    </div>
  );
}
