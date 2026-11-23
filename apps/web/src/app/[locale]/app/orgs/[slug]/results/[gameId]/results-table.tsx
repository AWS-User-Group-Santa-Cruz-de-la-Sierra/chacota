'use client';

import type { ResultEntry } from '@chacota/game/client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { buttonClass, Card, Notice } from '@/components/ui';

const PRESETS = [3, 5, 10] as const;

export function ResultsTable({ standings, exportBase }: { standings: ResultEntry[]; exportBase: string }) {
  const t = useTranslations('results');
  const [top, setTop] = useState<number>(Math.min(5, standings.length));
  const [copied, setCopied] = useState(false);
  const winners = standings.slice(0, top);
  // A shared rank right at the cutoff: someone outside the top has the same score as the last winner.
  const tieRank = top > 0 && standings[top] && standings[top]!.rank === standings[top - 1]!.rank ? standings[top]!.rank : null;
  const seconds = (ms?: number) => (ms === undefined ? '—' : (ms / 1000).toFixed(1));

  async function copy() {
    const text = winners.map((w) => `${w.rank}. ${w.nickname} (${w.code}) — ${w.score}`).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl font-bold">{t('winners')}</h3>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('prizesFor')}>
            <span className="text-sm text-niebla">{t('prizesFor')}</span>
            {PRESETS.filter((n) => n < standings.length).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={top === n}
                onClick={() => setTop(n)}
                className={buttonClass(top === n ? 'primary' : 'secondary', 'min-h-9 px-3 text-sm')}
              >
                {t('top', { n })}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={standings.length}
              value={top}
              onChange={(e) => setTop(Math.max(1, Math.min(standings.length, Number(e.target.value) || 1)))}
              aria-label={t('prizesFor')}
              className="min-h-9 w-20 rounded-xl border border-noche-3 bg-noche px-2 text-center tabular-nums"
            />
          </div>
        </div>

        {tieRank && <Notice>{t('tie', { rank: tieRank })}</Notice>}

        <ol className="grid gap-2 sm:grid-cols-2">
          {winners.map((w, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl bg-noche px-4 py-3">
              <span className="w-8 font-display text-2xl font-extrabold text-sol tabular-nums">{w.rank}</span>
              <span className="flex-1 truncate font-semibold">{w.nickname}</span>
              <span className="rounded-md bg-noche-3 px-2 py-0.5 font-mono text-sm tracking-widest" title={t('col.code')}>
                {w.code}
              </span>
              <span className="w-16 text-right font-display tabular-nums">{w.score}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-niebla">{t('codeHelp')}</p>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass('secondary')} onClick={copy}>
            {copied ? t('copied') : t('copy')}
          </button>
          <a className={buttonClass('secondary')} href={`${exportBase}&format=xlsx&top=${top}`}>
            {t('downloadTop', { n: top })} ({t('xlsx')})
          </a>
          <a className={buttonClass('primary')} href={`${exportBase}&format=xlsx`}>
            {t('download')} {t('all').toLowerCase()} ({t('xlsx')})
          </a>
          <a className={buttonClass('secondary')} href={`${exportBase}&format=csv`}>
            {t('download')} {t('all').toLowerCase()} ({t('csv')})
          </a>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 overflow-x-auto">
        <h3 className="font-display text-xl font-bold">{t('fullRanking')}</h3>
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-niebla">
            <tr>
              {(['rank', 'nickname', 'code', 'score', 'correct', 'answered', 'avgTime'] as const).map((c) => (
                <th key={c} className={`py-2 pr-3 font-medium ${c === 'nickname' || c === 'code' ? '' : 'text-right'}`}>
                  {t(`col.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((r, i) => (
              <tr key={i} className={`border-t border-noche-3 ${i < top ? 'bg-sol/10' : ''}`}>
                <td className="py-2 pr-3 text-right font-display tabular-nums">{r.rank}</td>
                <td className="py-2 pr-3">{r.nickname}</td>
                <td className="py-2 pr-3 font-mono tracking-widest">{r.code}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.score}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.correct}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.answered}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{seconds(r.avgCorrectMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
