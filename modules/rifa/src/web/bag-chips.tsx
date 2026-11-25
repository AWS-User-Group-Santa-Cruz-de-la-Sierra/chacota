'use client';

import { useTranslations } from 'next-intl';
import type { BagEntry, EntryStatus } from '../model';
import { chipScale } from './host-state';

/** By `chipScale`: the gap and type of the list, then each chip's padding. Never below 14px (text-sm). */
const LIST: string[] = ['gap-2.5 text-lg lg:text-2xl', 'gap-2 text-base lg:text-xl', 'gap-2 text-base lg:text-lg', 'gap-1.5 text-sm lg:text-base', 'gap-1.5 text-sm'];
const PAD: string[] = ['px-4 py-1.5 lg:py-2', 'px-3.5 py-1.5', 'px-3 py-1', 'px-2.5 py-1', 'px-2.5 py-0.5'];

const LOOK: Record<EntryStatus, string> = {
  bag: 'bg-noche-2 text-blanco hover:bg-noche-3',
  out: 'bg-noche-2/40 text-niebla hover:bg-noche-3/60',
  won: 'bg-sol font-bold text-noche disabled:cursor-default',
};

const ACTION: Record<EntryStatus, 'discard' | 'restore' | 'won'> = { bag: 'discard', out: 'restore', won: 'won' };

/**
 * Everyone in the rifa as chips: in the bag, discarded (💧, struck through) and winners (👑, gold,
 * can't be touched). The state shows in the mark and the type, not only the colour.
 */
export function BagChips({ entries, busy, onToggle }: { entries: BagEntry[]; busy: ReadonlySet<string>; onToggle(entry: BagEntry): void }) {
  const t = useTranslations('rifa.host');
  if (entries.length === 0) return <p className="py-4 text-center text-lg text-niebla">{t('empty')}</p>;
  const scale = chipScale(entries.length);
  return (
    <ul aria-label={t('bag')} className={`flex flex-wrap content-start ${LIST[scale]}`}>
      {entries.map((e) => (
        <li key={e.id} className="max-w-full">
          <button
            type="button"
            disabled={e.status === 'won'}
            aria-busy={busy.has(e.id) || undefined}
            aria-label={t(`chip.${ACTION[e.status]}`, { name: e.name })}
            title={e.name}
            onClick={() => onToggle(e)}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full font-semibold transition-colors ${PAD[scale]} ${LOOK[e.status]} ${busy.has(e.id) ? 'opacity-60' : ''}`}
          >
            {e.status !== 'bag' && <span aria-hidden="true">{e.status === 'out' ? '💧' : '👑'}</span>}
            <span className={`truncate ${e.status === 'out' ? 'line-through decoration-2' : ''}`}>{e.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
