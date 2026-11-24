'use client';

import { useTranslations } from 'next-intl';
import { ANIMALS, type Animal } from '../model';
import { ART } from './art';

/** The four critters as big buttons, with their names. */
export function AnimalPicker({ selected, onPick }: { selected: Animal | null; onPick: (animal: Animal) => void }) {
  const t = useTranslations('embolsau');
  return (
    <div className="grid w-full grid-cols-2 gap-3">
      {ANIMALS.map((animal) => (
        <button
          key={animal}
          type="button"
          aria-pressed={selected === animal}
          onClick={() => onPick(animal)}
          className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-colors ${
            selected === animal ? 'border-sol bg-noche-3' : 'border-noche-3 bg-noche-2 hover:border-morado-claro'
          }`}
        >
          <img src={ART[animal].icon} alt="" width={88} height={88} />
          <span className="font-display text-lg font-bold">{t(`animals.${animal}`)}</span>
        </button>
      ))}
    </div>
  );
}
