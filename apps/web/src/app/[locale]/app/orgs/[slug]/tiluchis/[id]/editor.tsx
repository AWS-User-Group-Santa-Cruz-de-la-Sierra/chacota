'use client';

import { type Language } from '@chacota/core';
import { changeType, isQuestionValid, LIMITS, move, newChoice, newQuestion, TIME_LIMITS, withFreshIds, type PointsMode, type Question, type QuestionType, type Tiluchi } from '@chacota/tiluchi/content';
import type { ImportWarning } from '@chacota/tiluchi/importers';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { AnswerIcon, ANSWER_STYLES } from '@/components/answer-icons';
import { buttonClass, Notice } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { startTiluchiAction } from '../../../../../host/actions';
import { deleteTiluchiAction, importQuestionsAction, saveTiluchiAction } from './actions';

type Status = 'idle' | 'saving' | 'saved' | 'conflict' | 'invalid';

const inputClass =
  'min-h-11 w-full rounded-xl border border-noche-3 bg-noche px-3 text-blanco placeholder:text-niebla/60 focus:border-morado-claro focus:outline-none';

export function TiluchiEditor({
  slug,
  initial,
  initialVersion,
}: {
  slug: string;
  initial: Tiluchi;
  initialVersion: number;
}) {
  const t = useTranslations('editor');
  const th = useTranslations('host');
  const [presentError, setPresentError] = useState<string | null>(null);
  const [presenting, startPresenting] = useTransition();
  const [tiluchi, setTiluchi] = useState<Tiluchi>(initial);
  const [version, setVersion] = useState(initialVersion);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [importNote, setImportNote] = useState<{ count: number; warnings: ImportWarning[] } | { error: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [importing, startImport] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const invalidIds = useMemo(
    () => new Set(tiluchi.questions.filter((q) => !isQuestionValid(q)).map((q) => q.id)),
    [tiluchi.questions],
  );
  const current = tiluchi.questions[selected];

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function update(changes: Partial<Tiluchi>) {
    setTiluchi((prev) => ({ ...prev, ...changes }));
    setDirty(true);
    if (status !== 'conflict') setStatus('idle');
  }

  function setQuestions(questions: Question[], select?: number) {
    update({ questions });
    if (select !== undefined) setSelected(Math.max(0, Math.min(select, questions.length - 1)));
  }

  function updateQuestion(q: Question) {
    setQuestions(tiluchi.questions.map((x, i) => (i === selected ? q : x)));
  }

  function save() {
    if (invalidIds.size > 0) {
      setStatus('invalid');
      const firstInvalid = tiluchi.questions.findIndex((q) => invalidIds.has(q.id));
      if (firstInvalid >= 0) setSelected(firstInvalid);
      return;
    }
    startSaving(async () => {
      setStatus('saving');
      const result = await saveTiluchiAction(slug, { tiluchi, version });
      if (result.ok) {
        setVersion(result.version);
        setDirty(false);
        setStatus('saved');
      } else {
        setStatus(result.error);
      }
    });
  }

  function onImport(file: File) {
    const form = new FormData();
    form.set('file', file);
    startImport(async () => {
      const result = await importQuestionsAction(slug, form);
      if (!result.ok) {
        setImportNote({ error: result.message });
        return;
      }
      const room = LIMITS.maxQuestions - tiluchi.questions.length;
      const added = result.questions.slice(0, Math.max(room, 0)).map(withFreshIds);
      if (added.length > 0) setQuestions([...tiluchi.questions, ...added], tiluchi.questions.length);
      setImportNote({ count: added.length, warnings: result.warnings });
    });
  }

  const statusText =
    status === 'saving' || saving
      ? t('saving')
      : status === 'saved' && !dirty
        ? t('saved')
        : dirty
          ? t('unsaved')
          : '';

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/app/orgs/${slug}`} className={buttonClass('ghost')}>
          ← {t('back')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-niebla" role="status" aria-live="polite">
            {statusText}
          </span>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = '';
            }}
          />
          <button type="button" className={buttonClass('secondary')} disabled={importing} onClick={() => fileInput.current?.click()} title={t('importHint')}>
            {t('import')}
          </button>
          <details className="relative">
            <summary className={buttonClass('secondary', 'cursor-pointer list-none')}>{t('export')}</summary>
            <div className="absolute right-0 z-10 mt-2 flex w-40 flex-col rounded-xl border border-noche-3 bg-noche-2 p-1">
              {(['json', 'xlsx', 'csv'] as const).map((f) => (
                <a
                  key={f}
                  href={`/api/orgs/${slug}/tiluchis/${tiluchi.id}/export?format=${f}`}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-noche-3"
                >
                  {f.toUpperCase()}
                </a>
              ))}
            </div>
          </details>
          <button type="button" className={buttonClass('primary')} onClick={save} disabled={saving || status === 'conflict'}>
            {saving ? t('saving') : t('save')}
          </button>
          <button
            type="button"
            className={buttonClass('secondary', 'border-sol/50 text-sol')}
            disabled={presenting || dirty || tiluchi.questions.length === 0}
            title={dirty ? th('presentHint') : undefined}
            onClick={() =>
              startPresenting(async () => {
                const result = await startTiluchiAction(slug, tiluchi.id);
                if (result?.error) setPresentError(result.error === 'org_not_active' ? th('orgNotActive') : th('notPlayable'));
              })
            }
          >
            ▶ {th('present')}
          </button>
        </div>
      </div>
      {presentError && <Notice>{presentError}</Notice>}

      {status === 'conflict' && <Notice>{t('conflict')}</Notice>}
      {status === 'invalid' && <Notice>{t('invalid', { count: invalidIds.size })}</Notice>}
      {importNote && <ImportNote note={importNote} onClose={() => setImportNote(null)} />}

      {/* Tiluchi details */}
      <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tiluchi-title" className="text-sm font-medium">
            {t('title')}
          </label>
          <input
            id="tiluchi-title"
            value={tiluchi.title}
            maxLength={LIMITS.title}
            onChange={(e) => update({ title: e.target.value })}
            className={`${inputClass} font-display text-2xl font-bold`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tiluchi-language" className="text-sm font-medium">
            {t('language')}
          </label>
          <select
            id="tiluchi-language"
            value={tiluchi.language}
            onChange={(e) => update({ language: e.target.value as Language })}
            className={inputClass}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        {/* Question list */}
        <aside className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-niebla">
            {t('questions')} · {tiluchi.questions.length}
          </h2>
          <ol className="flex flex-col gap-2">
            {tiluchi.questions.map((q, i) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-current={i === selected ? 'true' : undefined}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    i === selected ? 'border-morado-claro bg-noche-2' : 'border-noche-3 hover:bg-noche-2/60'
                  } ${invalidIds.has(q.id) ? 'outline outline-1 outline-tajibo' : ''}`}
                >
                  <span className="font-display text-lg font-bold text-niebla">{i + 1}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{q.prompt || t('untitled')}</span>
                    <span className="text-xs text-niebla">
                      {t(`types.${q.type}`)} · {t('seconds', { n: q.timeLimitSec })}
                      {invalidIds.has(q.id) && <span className="text-[#ff9cc0]"> · !</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {tiluchi.questions.length < LIMITS.maxQuestions && (
            <button
              type="button"
              className={buttonClass('secondary')}
              onClick={() => setQuestions([...tiluchi.questions, newQuestion('quiz')], tiluchi.questions.length)}
            >
              + {t('addQuestion')}
            </button>
          )}
        </aside>

        {/* Question form */}
        <section>
          {current ? (
            <QuestionForm
              key={current.id}
              question={current}
              index={selected}
              total={tiluchi.questions.length}
              invalid={invalidIds.has(current.id)}
              onChange={updateQuestion}
              onMove={(to) => setQuestions(move(tiluchi.questions, selected, to), to)}
              onDuplicate={() => {
                const copy = withFreshIds(current);
                const next = [...tiluchi.questions];
                next.splice(selected + 1, 0, copy);
                setQuestions(next, selected + 1);
              }}
              onDelete={() => setQuestions(tiluchi.questions.filter((_, i) => i !== selected), selected - 1)}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-noche-3 p-10 text-center text-niebla">{t('empty')}</p>
          )}
        </section>
      </div>

      <form
        action={deleteTiluchiAction.bind(null, slug, tiluchi.id)}
        onSubmit={(e) => {
          if (!confirm(t('confirmDelete'))) e.preventDefault();
        }}
        className="border-t border-noche-3 pt-6"
      >
        <button type="submit" className={buttonClass('danger')}>
          {t('deleteTiluchi')}
        </button>
      </form>
    </div>
  );
}

function ImportNote({
  note,
  onClose,
}: {
  note: { count: number; warnings: ImportWarning[] } | { error: string };
  onClose: () => void;
}) {
  const t = useTranslations('editor');
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-sol/30 bg-sol/10 px-4 py-3 text-sm text-sol">
      <div className="flex flex-col gap-2">
        {'error' in note ? (
          <p>{t('importError', { message: note.error })}</p>
        ) : (
          <>
            <p className="font-semibold">{t('imported', { count: note.count })}</p>
            {note.warnings.length > 0 && (
              <details>
                <summary className="cursor-pointer">
                  {t('warnings')} ({note.warnings.length})
                </summary>
                <ul className="mt-2 list-disc pl-5">
                  {note.warnings.map((w, i) => (
                    <li key={i}>{t(`warning.${w.code}`, { row: w.row ?? '?', detail: w.detail ?? '' })}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
      <button type="button" onClick={onClose} className={buttonClass('ghost', 'min-h-8 px-2')} aria-label="OK">
        ✕
      </button>
    </div>
  );
}

function QuestionForm({
  question: q,
  index,
  total,
  invalid,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  question: Question;
  index: number;
  total: number;
  invalid: boolean;
  onChange: (q: Question) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('editor');
  const id = (name: string) => `${q.id}-${name}`;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-noche-3 bg-noche-2/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-bold">
          {t('prompt')} {index + 1}
        </h2>
        <div className="flex flex-wrap gap-1">
          <button type="button" className={buttonClass('ghost')} disabled={index === 0} onClick={() => onMove(index - 1)}>
            ↑ {t('moveUp')}
          </button>
          <button type="button" className={buttonClass('ghost')} disabled={index === total - 1} onClick={() => onMove(index + 1)}>
            ↓ {t('moveDown')}
          </button>
          <button type="button" className={buttonClass('ghost')} onClick={onDuplicate} disabled={total >= LIMITS.maxQuestions}>
            {t('duplicate')}
          </button>
          <button type="button" className={buttonClass('danger')} onClick={onDelete}>
            {t('delete')}
          </button>
        </div>
      </div>

      {invalid && <p className="text-sm text-[#ff9cc0]">{t('questionInvalid')}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id('type')} className="text-sm font-medium">
            {t('type')}
          </label>
          <select id={id('type')} value={q.type} onChange={(e) => onChange(changeType(q, e.target.value as QuestionType))} className={inputClass}>
            {(['quiz', 'true_false', 'poll'] as const).map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id('time')} className="text-sm font-medium">
            {t('timeLimit')}
          </label>
          <select
            id={id('time')}
            value={q.timeLimitSec}
            onChange={(e) => onChange({ ...q, timeLimitSec: Number(e.target.value) })}
            className={inputClass}
          >
            {TIME_LIMITS.map((s) => (
              <option key={s} value={s}>
                {t('seconds', { n: s })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id('points')} className="text-sm font-medium">
            {t('points')}
          </label>
          <select
            id={id('points')}
            value={q.points}
            disabled={q.type === 'poll'}
            onChange={(e) => q.type !== 'poll' && onChange({ ...q, points: e.target.value as PointsMode })}
            className={inputClass}
          >
            {(['standard', 'double', 'none'] as const).map((p) => (
              <option key={p} value={p}>
                {t(`pointsModes.${p}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={id('prompt')} className="text-sm font-medium">
          {t('prompt')}
        </label>
        <textarea
          id={id('prompt')}
          value={q.prompt}
          maxLength={LIMITS.prompt}
          rows={2}
          placeholder={t('promptPlaceholder')}
          onChange={(e) => onChange({ ...q, prompt: e.target.value })}
          className={`${inputClass} py-2 font-display text-xl font-bold`}
        />
        <span className="self-end text-xs text-niebla">
          {q.prompt.length}/{LIMITS.prompt}
        </span>
      </div>

      {q.type === 'true_false' ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t('correctAnswer')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {[true, false].map((value, i) => (
              <label
                key={String(value)}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-4 font-semibold ${ANSWER_STYLES[i]!.bg} ${ANSWER_STYLES[i]!.fg} ${
                  q.correct === value ? 'ring-4 ring-sol' : 'opacity-70'
                }`}
              >
                <input type="radio" name={id('tf')} checked={q.correct === value} onChange={() => onChange({ ...q, correct: value })} className="h-5 w-5" />
                <AnswerIcon index={i} size={24} />
                {value ? t('trueLabel') : t('falseLabel')}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">{t('choices')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {q.choices.map((c, i) => {
              const style = ANSWER_STYLES[i % ANSWER_STYLES.length]!;
              const setChoices = (choices: typeof q.choices) => onChange({ ...q, choices } as Question);
              return (
                <div key={c.id} className={`flex items-center gap-2 rounded-xl p-2 pl-3 ${style.bg} ${style.fg}`}>
                  <AnswerIcon index={i} size={24} />
                  <label className="sr-only" htmlFor={id(`choice-${i}`)}>
                    {t('choice', { n: i + 1 })}
                  </label>
                  <input
                    id={id(`choice-${i}`)}
                    value={c.text}
                    maxLength={LIMITS.choice}
                    placeholder={t('choice', { n: i + 1 })}
                    onChange={(e) => setChoices(q.choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) as typeof q.choices)}
                    className="min-h-11 min-w-0 flex-1 rounded-lg bg-noche/30 px-3 font-semibold text-inherit placeholder:text-current placeholder:opacity-60 focus:bg-noche/50 focus:outline-none"
                  />
                  {q.type === 'quiz' && (
                    <label className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-noche/30 px-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={c.correct}
                        onChange={(e) => setChoices(q.choices.map((x) => (x.id === c.id ? { ...x, correct: e.target.checked } : x)))}
                        className="h-5 w-5"
                      />
                      {t('correct')}
                    </label>
                  )}
                  {q.choices.length > LIMITS.minChoices && (
                    <button
                      type="button"
                      onClick={() => setChoices(q.choices.filter((x) => x.id !== c.id) as typeof q.choices)}
                      aria-label={t('removeChoice', { n: i + 1 })}
                      className="min-h-11 rounded-lg px-3 hover:bg-noche/30"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {q.choices.length < LIMITS.maxChoices && (
            <button
              type="button"
              className={buttonClass('secondary', 'self-start')}
              onClick={() => onChange({ ...q, choices: [...q.choices, newChoice()] } as Question)}
            >
              + {t('addChoice')}
            </button>
          )}
        </fieldset>
      )}
    </div>
  );
}
